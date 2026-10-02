"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { hasPermission } from "@/lib/factory-roles";
import { sensitiveReasonError } from "@/lib/domain/sensitive-reason";
import { sanitizeRichText } from "@/lib/sanitize";
import { logActivity } from "@/server/activity";
import { appendPremiumMovement } from "@/features/ledger/record";
import { generateProposalNumber } from "@/features/proposals/number-generator";
import { basePrisma } from "@/server/db";
import { addCalendarYear } from "@/lib/domain/term";
import { parseDeductible } from "@/lib/domain/deductible";
import { canDeletePolicy } from "@/lib/roles";
import {
  policyFormSchema,
  policyStatusChangeSchema,
  nonRenewalSchema,
  NON_RENEWAL_REASON_LABELS,
  POLICY_STATUS_LABELS,
  type NonRenewalValues,
  type PolicyFormValues,
  type PolicyStatusChangeValues,
} from "./schemas";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function amount(value: string): string | null {
  return value === "" ? null : value;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function deductibleFields(text: string | null | undefined) {
  const parsed = parseDeductible(text);
  const dec = (value: number | null) =>
    value == null ? null : new Prisma.Decimal(value.toFixed(4));
  return {
    deductible: parsed.text,
    deductibleAmount: dec(parsed.amount),
    deductiblePct: dec(parsed.pct),
    deductibleMinimum: dec(parsed.minimum),
  };
}

function addYear(date: Date | null): Date | null {
  if (!date) return null;
  return addCalendarYear(date);
}

export async function createPolicyAction(
  values: PolicyFormValues,
): Promise<ActionResult> {
  const parsed = policyFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const client = await db.client.findFirst({
    where: { id: data.clientId },
    select: { id: true, name: true },
  });
  if (!client) {
    return {
      ok: false,
      error: "El cliente seleccionado no existe.",
      fieldErrors: { clientId: "Cliente inválido" },
    };
  }

  // No crear una segunda póliza para una propuesta que ya tiene una vinculada
  // (review #6): el despacho ya la crea automáticamente.
  const linkedProposalId = emptyToNull(data.proposalId);
  let proposalSalespersonId: string | null = null;
  if (linkedProposalId) {
    const existing = await db.policy.findFirst({
      where: { proposalId: linkedProposalId },
      select: { policyNumber: true },
    });
    if (existing) {
      return {
        ok: false,
        error: `La propuesta ya tiene una póliza vinculada (N° ${existing.policyNumber}).`,
      };
    }
    // El vendedor de la póliza se precarga desde la propuesta de origen
    // (override de tasa por póliza se gestiona en /comisiones).
    const sourceProposal = await db.proposal.findFirst({
      where: { id: linkedProposalId },
      select: { salespersonId: true },
    });
    proposalSalespersonId = sourceProposal?.salespersonId ?? null;
  }

  try {
    const policy = await db.$transaction(async (tx) => {
      const created = await tx.policy.create({
        data: {
          organizationId: ctx.organizationId,
          clientId: data.clientId,
          proposalId: emptyToNull(data.proposalId),
          policyNumber: data.policyNumber,
          companyId: emptyToNull(data.companyId),
          lineId: emptyToNull(data.lineId),
          branchId: emptyToNull(data.branchId),
          status: "VIGENTE",
          premiumNet: amount(data.premiumNet),
          currency: data.currency,
          startDate: parseDate(data.startDate),
          endDate: parseDate(data.endDate),
          assignedUserId: emptyToNull(data.assignedUserId) ?? ctx.userId,
          salespersonId:
            emptyToNull(data.salespersonId) ?? proposalSalespersonId,
          createdById: ctx.userId,
        },
      });
      if (data.items.length > 0) {
        await tx.policyItem.createMany({
          data: data.items.map((item) => ({
            organizationId: ctx.organizationId,
            policyId: created.id,
            description: item.description,
            insuredAmount: amount(item.insuredAmount),
            currency: data.currency,
          })),
        });
      }
      if (data.coverages.length > 0) {
        await tx.policyCoverage.createMany({
          data: data.coverages.map((coverage) => ({
            organizationId: ctx.organizationId,
            policyId: created.id,
            name: coverage.name,
            ...deductibleFields(emptyToNull(coverage.deductible)),
            insuredAmount: amount(coverage.insuredAmount),
            currency: data.currency,
          })),
        });
      }
      await tx.policyStatusHistory.create({
        data: {
          organizationId: ctx.organizationId,
          policyId: created.id,
          status: "VIGENTE",
          note: "Póliza registrada",
          changedById: ctx.userId,
        },
      });
      const net = Number(data.premiumNet);
      if (net > 0) {
        await appendPremiumMovement(tx, {
          organizationId: ctx.organizationId,
          policyId: created.id,
          movementType: "ISSUE",
          issuedOn: new Date(),
          effectiveOn: parseDate(data.startDate) ?? new Date(),
          currency: data.currency,
          createdById: ctx.userId,
          parts: { affected: net, exempt: 0 },
        });
      }

      // Si viene de propuesta: vincular plan de pago e installments + marcar propuesta como emitida
      const proposalId = emptyToNull(data.proposalId);
      if (proposalId) {
        const plan = await tx.paymentPlan.findUnique({
          where: { proposalId },
          select: { id: true },
        });
        if (plan) {
          await tx.paymentPlan.update({
            where: { id: plan.id },
            data: { policyId: created.id },
          });
          await tx.installment.updateMany({
            where: { paymentPlanId: plan.id, policyId: null },
            data: { policyId: created.id },
          });
        }
        // La propuesta queda vinculada a la póliza (sale del flujo de
        // propuestas). Se mantiene en POR_DESPACHAR y se registra la bitácora.
        await tx.proposal.update({
          where: { id: proposalId },
          data: { status: "POR_DESPACHAR" },
        });
        await tx.proposalStatusHistory.create({
          data: {
            organizationId: ctx.organizationId,
            proposalId,
            status: "POR_DESPACHAR",
            note: `Convertida en póliza ${created.policyNumber}`,
            changedById: ctx.userId,
          },
        });
        await tx.proposalLog.create({
          data: {
            organizationId: ctx.organizationId,
            proposalId,
            action: "CONVERTED_TO_POLICY",
            summary: `Convertida en póliza ${created.policyNumber}`,
            userId: ctx.userId,
          },
        });
      }
      return created;
    });

    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "POLICY",
      entityId: policy.id,
      action: "created",
      summary: `Póliza ${policy.policyNumber} registrada para ${client.name}`,
      userId: ctx.userId,
    });

    revalidatePath("/polizas");
    revalidatePath("/renovaciones");
    return { ok: true, id: policy.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Ya existe una póliza con ese número.",
        fieldErrors: { policyNumber: "Número duplicado" },
      };
    }
    throw error;
  }
}

export async function updatePolicyAction(
  id: string,
  values: PolicyFormValues,
): Promise<ActionResult> {
  const parsed = policyFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const existing = await db.policy.findFirst({ where: { id } });
  if (!existing) {
    return { ok: false, error: "La póliza no existe o no tienes acceso." };
  }
  const client = await db.client.findFirst({
    where: { id: data.clientId },
    select: { id: true },
  });
  if (!client) {
    return {
      ok: false,
      error: "El cliente seleccionado no existe.",
      fieldErrors: { clientId: "Cliente inválido" },
    };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.policy.update({
        where: { id },
        data: {
          clientId: data.clientId,
          policyNumber: data.policyNumber,
          companyId: emptyToNull(data.companyId),
          lineId: emptyToNull(data.lineId),
          branchId: emptyToNull(data.branchId),
          premiumNet: amount(data.premiumNet),
          currency: data.currency,
          startDate: parseDate(data.startDate),
          endDate: parseDate(data.endDate),
          assignedUserId: emptyToNull(data.assignedUserId) ?? ctx.userId,
          salespersonId: emptyToNull(data.salespersonId),
        },
      });
      await tx.policyItem.deleteMany({ where: { policyId: id } });
      await tx.policyCoverage.deleteMany({ where: { policyId: id } });
      if (data.items.length > 0) {
        await tx.policyItem.createMany({
          data: data.items.map((item) => ({
            organizationId: ctx.organizationId,
            policyId: id,
            description: item.description,
            insuredAmount: amount(item.insuredAmount),
            currency: data.currency,
          })),
        });
      }
      if (data.coverages.length > 0) {
        await tx.policyCoverage.createMany({
          data: data.coverages.map((coverage) => ({
            organizationId: ctx.organizationId,
            policyId: id,
            name: coverage.name,
            ...deductibleFields(emptyToNull(coverage.deductible)),
            insuredAmount: amount(coverage.insuredAmount),
            currency: data.currency,
          })),
        });
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Ya existe una póliza con ese número.",
        fieldErrors: { policyNumber: "Número duplicado" },
      };
    }
    throw error;
  }

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "POLICY",
    entityId: id,
    action: "updated",
    summary: `Póliza ${data.policyNumber} actualizada`,
    userId: ctx.userId,
  });

  revalidatePath("/polizas");
  revalidatePath(`/polizas/${id}`);
  return { ok: true, id };
}

export async function changePolicyStatusAction(
  id: string,
  values: PolicyStatusChangeValues,
): Promise<ActionResult> {
  const parsed = policyStatusChangeSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Datos de cambio de estado inválidos." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const policy = await db.policy.findFirst({
    where: { id },
    select: { id: true, status: true, policyNumber: true },
  });
  if (!policy) {
    return { ok: false, error: "La póliza no existe o no tienes acceso." };
  }
  if (policy.status === data.status) {
    return { ok: false, error: "La póliza ya está en ese estado." };
  }

  await db.$transaction(async (tx) => {
    await tx.policy.update({
      where: { id },
      data: { status: data.status },
    });
    await tx.policyStatusHistory.create({
      data: {
        organizationId: ctx.organizationId,
        policyId: id,
        status: data.status,
        note: emptyToNull(sanitizeRichText(data.note)),
        changedById: ctx.userId,
      },
    });
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "POLICY",
    entityId: id,
    action: "status_changed",
    summary: `Póliza ${policy.policyNumber}: ${POLICY_STATUS_LABELS[data.status]}`,
    userId: ctx.userId,
  });

  revalidatePath("/polizas");
  revalidatePath(`/polizas/${id}`);
  revalidatePath("/renovaciones");
  return { ok: true, id };
}

const OPEN_RENEWAL = [
  "ELABORACION",
  "POR_ENVIAR",
  "ENVIADA_COMPANIA",
  "DEVUELTA",
  "POR_DESPACHAR",
] as const;

async function assertRenewable(
  db: Awaited<ReturnType<typeof requireOrgDb>>["db"],
  id: string,
) {
  const policy = await db.policy.findFirst({
    where: { id },
    include: { items: true, coverages: true },
  });
  if (!policy) return { ok: false as const, error: "La póliza no existe o no tienes acceso." };
  if (policy.status === "RENOVADA") {
    return { ok: false as const, error: "Esta póliza ya fue renovada." };
  }
  if (policy.status === "CANCELADA" || policy.status === "ANULADA") {
    return { ok: false as const, error: "Una póliza cancelada o anulada no se renueva." };
  }
  if (policy.notRenewable) {
    return { ok: false as const, error: "Esta póliza está marcada como no renovable." };
  }
  if (policy.nonRenewalAt) {
    return {
      ok: false as const,
      error: "Hay una no renovación registrada. Revierte esa decisión antes de renovar.",
    };
  }
  const [openProposal, issuedChild] = await Promise.all([
    db.proposal.findFirst({
      where: { previousPolicyId: id, kind: "POLIZA", status: { in: [...OPEN_RENEWAL] } },
      select: { id: true },
    }),
    db.policy.findFirst({
      where: { previousPolicyId: id, status: { in: ["VIGENTE", "VENCIDA", "RENOVADA"] } },
      select: { id: true },
    }),
  ]);
  if (openProposal) {
    return { ok: false as const, error: "Ya hay una renovación en curso para esta póliza." };
  }
  if (issuedChild) {
    return { ok: false as const, error: "Esta póliza ya tiene una sucesora emitida." };
  }
  return { ok: true as const, policy };
}

/** Abre la sucesora en elaboración. El origen no se marca renovado hasta que se emita. */
export async function renewPolicyAction(id: string): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "renewals.manage")) {
    return { ok: false, error: "No tienes permiso para renovar." };
  }
  const ready = await assertRenewable(db, id);
  if (!ready.ok) return ready;
  const policy = ready.policy;
  const source = policy.proposalId
    ? await db.proposal.findFirst({
        where: { id: policy.proposalId },
        select: {
          branchTypeId: true,
          productId: true,
          insuredClientId: true,
          beneficiaryClientId: true,
          commissionAffectPct: true,
          commissionExemptPct: true,
          startTime: true,
          endTime: true,
          contratanteEmail: true,
          contratantePhone: true,
          contratanteCelular: true,
        },
      })
    : null;
  const sourceItems = policy.proposalId
    ? await db.proposalItem.findMany({
        where: { proposalId: policy.proposalId },
        orderBy: { order: "asc" },
        include: { coverages: { orderBy: { order: "asc" } } },
      })
    : [];

  try {
    const proposalNumber = await generateProposalNumber(basePrisma, ctx.organizationId);
    const startDate = policy.endDate;
    const endDate = addYear(policy.endDate);
    const created = await db.$transaction(async (tx) => {
      const proposal = await tx.proposal.create({
        data: {
          organizationId: ctx.organizationId,
          clientId: policy.clientId,
          proposalNumber,
          kind: "POLIZA",
          isRenewal: true,
          previousPolicyId: policy.id,
          previousPolicyNumberText: policy.policyNumber,
          companyId: policy.companyId,
          lineId: policy.lineId,
          branchId: policy.branchId,
          branchTypeId: source?.branchTypeId ?? null,
          productId: policy.productId ?? source?.productId ?? null,
          status: "ELABORACION",
          premiumNet: policy.premiumNet,
          currency: policy.currency,
          startDate,
          endDate,
          startTime: source?.startTime ?? null,
          endTime: source?.endTime ?? null,
          insuredClientId: source?.insuredClientId ?? null,
          beneficiaryClientId: source?.beneficiaryClientId ?? null,
          contratanteEmail: source?.contratanteEmail ?? null,
          contratantePhone: source?.contratantePhone ?? null,
          contratanteCelular: source?.contratanteCelular ?? null,
          commissionAffectPct: source?.commissionAffectPct ?? policy.commissionAffectPct,
          commissionExemptPct: source?.commissionExemptPct ?? policy.commissionExemptPct,
          observations: policy.premiumNet
            ? `Prima del período anterior: ${policy.premiumNet.toString()} ${policy.currency}. Confirmar o actualizar antes de enviar.`
            : "Confirmar la prima del nuevo período antes de enviar.",
          assignedUserId: policy.assignedUserId,
          salespersonId: policy.salespersonId,
          createdById: ctx.userId,
        },
      });
      await tx.proposalStatusHistory.create({
        data: {
          organizationId: ctx.organizationId,
          proposalId: proposal.id,
          status: "ELABORACION",
          note: `Renovación de ${policy.policyNumber}. La sucesora queda en elaboración.`,
          changedById: ctx.userId,
        },
      });
      for (const item of sourceItems) {
        const copy = await tx.proposalItem.create({
          data: {
            organizationId: ctx.organizationId,
            proposalId: proposal.id,
            branchTypeId: item.branchTypeId,
            order: item.order,
            insuredClientId: item.insuredClientId,
            beneficiaryClientId: item.beneficiaryClientId,
            identification: item.identification,
            glossNote: item.glossNote,
            data: item.data ?? {},
            dataSchemaVersion: item.dataSchemaVersion,
          },
        });
        if (item.coverages.length > 0) {
          await tx.proposalItemCoverage.createMany({
            data: item.coverages.map((coverage) => ({
              organizationId: ctx.organizationId,
              itemId: copy.id,
              order: coverage.order,
              name: coverage.name,
              polCad: coverage.polCad,
              type: coverage.type,
              isCommercialValue: coverage.isCommercialValue,
              insuredAmount: coverage.insuredAmount,
              insuredCurrency: coverage.insuredCurrency,
              affectedByIva: coverage.affectedByIva,
              taxRateAffect: coverage.taxRateAffect,
              taxRateExempt: coverage.taxRateExempt,
              premiumAffect: coverage.premiumAffect,
              premiumExempt: coverage.premiumExempt,
              premiumNet: coverage.premiumNet,
              ivaAmount: coverage.ivaAmount,
              premiumGross: coverage.premiumGross,
              commissionAffectPct: coverage.commissionAffectPct,
              commissionExemptPct: coverage.commissionExemptPct,
              commissionAmount: coverage.commissionAmount,
              sumsToTotal: coverage.sumsToTotal,
              deductibleText: coverage.deductibleText,
              deductibleAmount: coverage.deductibleAmount,
              deductiblePct: coverage.deductiblePct,
              deductibleMinimum: coverage.deductibleMinimum,
              manualPremium: coverage.manualPremium,
            })),
          });
        }
      }
      return proposal;
    });

    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "PROPOSAL",
      entityId: created.id,
      action: "renewal_draft",
      summary: `Renovación de ${policy.policyNumber} abierta en elaboración`,
      userId: ctx.userId,
    });
    revalidatePath("/polizas");
    revalidatePath("/propuestas");
    revalidatePath("/renovaciones");
    return { ok: true, id: created.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "No se pudo asignar el número de la renovación. Intenta otra vez." };
    }
    throw error;
  }
}

/** Copia emitida para la renovación masiva que la compañía ya emitió. */
async function issueRenewalCopy(id: string): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  const ready = await assertRenewable(db, id);
  if (!ready.ok) return ready;
  const policy = ready.policy;

  const newNumber = `${policy.policyNumber}-R`;
  try {
    const created = await db.$transaction(async (tx) => {
      const renewed = await tx.policy.create({
        data: {
          organizationId: ctx.organizationId,
          clientId: policy.clientId,
          policyNumber: newNumber,
          companyId: policy.companyId,
          lineId: policy.lineId,
          status: "VIGENTE",
          premiumNet: policy.premiumNet,
          currency: policy.currency,
          startDate: policy.endDate,
          endDate: addYear(policy.endDate),
          previousPolicyId: policy.id,
          assignedUserId: policy.assignedUserId,
          createdById: ctx.userId,
        },
      });
      if (policy.items.length > 0) {
        await tx.policyItem.createMany({
          data: policy.items.map((item) => ({
            organizationId: ctx.organizationId,
            policyId: renewed.id,
            description: item.description,
            insuredAmount: item.insuredAmount,
            currency: item.currency,
          })),
        });
      }
      if (policy.coverages.length > 0) {
        await tx.policyCoverage.createMany({
          data: policy.coverages.map((coverage) => ({
            organizationId: ctx.organizationId,
            policyId: renewed.id,
            name: coverage.name,
            ...(coverage.deductibleAmount != null ||
            coverage.deductiblePct != null ||
            coverage.deductibleMinimum != null
              ? {
                  deductible: coverage.deductible,
                  deductibleAmount: coverage.deductibleAmount,
                  deductiblePct: coverage.deductiblePct,
                  deductibleMinimum: coverage.deductibleMinimum,
                }
              : deductibleFields(coverage.deductible)),
            insuredAmount: coverage.insuredAmount,
            currency: coverage.currency,
          })),
        });
      }
      await tx.policyStatusHistory.create({
        data: {
          organizationId: ctx.organizationId,
          policyId: renewed.id,
          status: "VIGENTE",
          note: `Renovación de ${policy.policyNumber}`,
          changedById: ctx.userId,
        },
      });
      const renewedNet = policy.premiumNet ? Number(policy.premiumNet) : 0;
      if (renewedNet > 0) {
        await appendPremiumMovement(tx, {
          organizationId: ctx.organizationId,
          policyId: renewed.id,
          movementType: "ISSUE",
          issuedOn: new Date(),
          effectiveOn: policy.endDate ?? new Date(),
          currency: policy.currency,
          createdById: ctx.userId,
          parts: {
            affected: policy.premiumAffect
              ? Number(policy.premiumAffect)
              : renewedNet,
            exempt: policy.premiumExempt ? Number(policy.premiumExempt) : 0,
            pctAffected: policy.commissionAffectPct
              ? Number(policy.commissionAffectPct)
              : 0,
            pctExempt: policy.commissionExemptPct
              ? Number(policy.commissionExemptPct)
              : 0,
          },
        });
      }
      await tx.policy.update({
        where: { id: policy.id },
        data: { status: "RENOVADA", nextPolicyId: renewed.id },
      });
      await tx.policyStatusHistory.create({
        data: {
          organizationId: ctx.organizationId,
          policyId: policy.id,
          status: "RENOVADA",
          note: `Renovada como ${newNumber}`,
          changedById: ctx.userId,
        },
      });
      return renewed;
    });

    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "POLICY",
      entityId: created.id,
      action: "created",
      summary: `Póliza ${newNumber} creada por renovación de ${policy.policyNumber}`,
      userId: ctx.userId,
    });
    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "POLICY",
      entityId: policy.id,
      action: "renewed",
      summary: `Póliza ${policy.policyNumber} renovada`,
      userId: ctx.userId,
    });

    revalidatePath("/polizas");
    revalidatePath("/renovaciones");
    return { ok: true, id: created.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: `Ya existe la póliza ${newNumber}. Edita su número antes de renovar otra vez.`,
      };
    }
    throw error;
  }
}

export async function recordNonRenewalAction(
  id: string,
  values: NonRenewalValues,
): Promise<ActionResult> {
  const parsed = nonRenewalSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Elige un motivo de no renovación." };
  }
  const { ctx, db } = await requireOrgDb();
  const policy = await db.policy.findFirst({
    where: { id },
    select: { id: true, policyNumber: true, status: true },
  });
  if (!policy) return { ok: false, error: "La póliza no existe o no tienes acceso." };
  if (policy.status === "RENOVADA" || policy.status === "CANCELADA" || policy.status === "ANULADA") {
    return { ok: false, error: "Esta póliza ya no está en la cola de renovación." };
  }

  await db.policy.update({
    where: { id },
    data: {
      nonRenewalReason: parsed.data.reason,
      nonRenewalNote: emptyToNull(parsed.data.note),
      nonRenewalAt: new Date(),
    },
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "POLICY",
    entityId: id,
    action: "non_renewal",
    summary: `Póliza ${policy.policyNumber} no se renueva: ${NON_RENEWAL_REASON_LABELS[parsed.data.reason]}`,
    userId: ctx.userId,
  });
  revalidatePath("/polizas");
  revalidatePath(`/polizas/${id}`);
  revalidatePath("/renovaciones");
  revalidatePath("/informes");
  return { ok: true, id };
}

export async function revertNonRenewalAction(id: string): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  const policy = await db.policy.findFirst({
    where: { id },
    select: { id: true, policyNumber: true, nonRenewalAt: true },
  });
  if (!policy) return { ok: false, error: "La póliza no existe o no tienes acceso." };
  if (!policy.nonRenewalAt) {
    return { ok: false, error: "Esta póliza no tiene una no renovación registrada." };
  }
  await db.policy.update({
    where: { id },
    data: {
      nonRenewalReason: null,
      nonRenewalNote: null,
      nonRenewalAt: null,
    },
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "POLICY",
    entityId: id,
    action: "non_renewal_reverted",
    summary: `No renovación revertida en la póliza ${policy.policyNumber}`,
    userId: ctx.userId,
  });
  revalidatePath("/polizas");
  revalidatePath(`/polizas/${id}`);
  revalidatePath("/renovaciones");
  revalidatePath("/informes");
  return { ok: true, id };
}

export async function setPolicyRenewableAction(
  id: string,
  renewable: boolean,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  const policy = await db.policy.findFirst({
    where: { id },
    select: { id: true, policyNumber: true },
  });
  if (!policy) return { ok: false, error: "La póliza no existe o no tienes acceso." };
  await db.policy.update({
    where: { id },
    data: { notRenewable: !renewable },
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "POLICY",
    entityId: id,
    action: "renewable_changed",
    summary: renewable
      ? `Póliza ${policy.policyNumber} vuelve a ser renovable`
      : `Póliza ${policy.policyNumber} marcada como no renovable`,
    userId: ctx.userId,
  });
  revalidatePath("/polizas");
  revalidatePath(`/polizas/${id}`);
  revalidatePath("/renovaciones");
  revalidatePath("/informes");
  return { ok: true, id };
}

export async function deletePolicyAction(id: string): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!canDeletePolicy(ctx.role)) {
    return { ok: false, error: "No tienes permiso para eliminar pólizas." };
  }

  const existing = await db.policy.findFirst({
    where: { id },
    select: { id: true, policyNumber: true },
  });
  if (!existing) {
    return { ok: false, error: "La póliza no existe o no tienes acceso." };
  }

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "POLICY",
    entityId: id,
    action: "deleted",
    summary: `Póliza ${existing.policyNumber} eliminada`,
    userId: ctx.userId,
  });
  await db.policy.delete({ where: { id } });

  revalidatePath("/polizas");
  revalidatePath("/renovaciones");
  return { ok: true, id };
}

/** Renueva las vigentes del mes. Borrador, o ya emitida si la compañía la renovó. */
export async function bulkRenewMonthAction(form: FormData): Promise<void> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "renewals.bulk")) {
    redirect("/renovaciones?aviso=No+tienes+permiso+para+renovar+en+lote.");
  }
  const reason = String(form.get("reason") ?? "");
  const reasonError = sensitiveReasonError(reason);
  if (reasonError) {
    redirect(`/renovaciones?aviso=${encodeURIComponent(reasonError)}`);
  }
  const issued = String(form.get("initial") ?? "DRAFT") === "ISSUED";
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const soap = await db.insuranceLine.findMany({
    where: {
      OR: [
        { code: { equals: "soap", mode: "insensitive" } },
        { name: { contains: "soap", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  const policies = await db.policy.findMany({
    where: {
      status: "VIGENTE",
      notRenewable: false,
      nonRenewalAt: null,
      endDate: { gte: start, lt: end },
      ...(soap.length > 0 ? { NOT: { lineId: { in: soap.map((line) => line.id) } } } : {}),
    },
    select: { id: true },
    take: 200,
  });
  let renewed = 0;
  for (const policy of policies) {
    const result = issued ? await issueRenewalCopy(policy.id) : await renewPolicyAction(policy.id);
    if (result.ok) renewed += 1;
  }
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "POLICY",
    entityId: policies[0]?.id ?? ctx.organizationId,
    action: "bulk_renew",
    summary: `Renovación masiva (${issued ? "emitida" : "borrador"}): ${renewed} de ${policies.length}. ${reason.trim()}`,
    userId: ctx.userId,
  });
  revalidatePath("/renovaciones");
  revalidatePath("/propuestas");
  redirect(
    `/renovaciones?aviso=${encodeURIComponent(
      issued
        ? `Se emitieron ${renewed} de ${policies.length} renovaciones del mes.`
        : `Se abrieron ${renewed} de ${policies.length} renovaciones en elaboración.`,
    )}`,
  );
}

/** Recotizar no crea la sucesora: el origen sigue pendiente, con la marca de cotización. */
export async function quoteRenewalAction(form: FormData): Promise<void> {
  const id = String(form.get("policyId") ?? "");
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "quotes.write")) {
    redirect(`/renovaciones?aviso=${encodeURIComponent("No tienes permiso para cotizar.")}`);
  }
  const policy = await db.policy.findFirst({
    where: { id },
    select: { id: true, policyNumber: true, clientId: true, currency: true, assignedUserId: true },
  });
  if (!policy) {
    redirect(`/renovaciones?aviso=${encodeURIComponent("La póliza no existe.")}`);
  }
  const existing = await db.quoteRequest.findFirst({
    where: {
      sourcePolicyId: id,
      origin: "RENEWAL",
      status: { in: ["BORRADOR", "SOLICITADA", "COTIZADA", "ENVIADA_CLIENTE"] },
    },
    select: { id: true },
  });
  if (existing) {
    redirect(`/cotizaciones/${existing.id}`);
  }
  const created = await db.quoteRequest.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: policy.clientId,
      title: `Renovación ${policy.policyNumber}`,
      status: "BORRADOR",
      currency: policy.currency,
      origin: "RENEWAL",
      sourcePolicyId: policy.id,
      assignedUserId: policy.assignedUserId ?? ctx.userId,
      createdById: ctx.userId,
    },
  });
  revalidatePath("/renovaciones");
  revalidatePath("/cotizaciones");
  redirect(`/cotizaciones/${created.id}`);
}
