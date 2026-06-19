"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { logActivity } from "@/server/activity";
import { canDeletePolicy } from "@/lib/roles";
import {
  policyFormSchema,
  policyStatusChangeSchema,
  POLICY_STATUS_LABELS,
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

function addYear(date: Date | null): Date | null {
  if (!date) return null;
  return new Date(
    Date.UTC(date.getUTCFullYear() + 1, date.getUTCMonth(), date.getUTCDate()),
  );
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
          salespersonId: proposalSalespersonId,
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
            deductible: emptyToNull(coverage.deductible),
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
            deductible: emptyToNull(coverage.deductible),
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
        note: emptyToNull(data.note),
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

export async function renewPolicyAction(id: string): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();

  const policy = await db.policy.findFirst({
    where: { id },
    include: { items: true, coverages: true },
  });
  if (!policy) {
    return { ok: false, error: "La póliza no existe o no tienes acceso." };
  }
  if (policy.status === "RENOVADA") {
    return { ok: false, error: "Esta póliza ya fue renovada." };
  }

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
            deductible: coverage.deductible,
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
