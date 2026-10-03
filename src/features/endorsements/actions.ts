"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { basePrisma } from "@/server/db";
import { logActivity } from "@/server/activity";
import { generateProposalNumber } from "@/features/proposals/number-generator";
import { isProposalLocked } from "@/features/proposals/schemas";
import { setTenantGuc } from "@/server/tenant-rls";
import { applyEndorsementToPolicy, deleteEndorsementInTx } from "./apply";
import {
  endorsementSchema,
  endorsementProposalSchema,
  endorsementTransitionError,
  ENDORSEMENT_TYPE_LABELS,
  parsePremiumDelta,
  endorsementUsesCalculatedCredit,
  type EndorsementValues,
  type EndorsementProposalValues,
} from "./schemas";
import { hasPermission } from "@/lib/factory-roles";
import {
  inalterabilityDecision,
  specEndorsementOf,
} from "@/lib/domain/endorsement-catalog";
import { endorsementPremium } from "@/lib/domain/endorsement-calc";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function toNullable(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

function toDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function deltaDecimal(value: string): Prisma.Decimal | null {
  const amount = parsePremiumDelta(value);
  if (amount == null) return null;
  return new Prisma.Decimal(amount.toFixed(4));
}

/**
 * Nuevo endoso sobre una póliza.
 *  - mode PROPUESTA: crea una propuesta de endoso (Proposal kind ENDOSO) que
 *    sigue el flujo de propuestas; devuelve `proposalId` para abrirla.
 *  - mode DIRECTO: registra el endoso ya emitido y aplica su efecto de estado.
 */
export async function createEndorsementAction(
  policyId: string,
  raw: EndorsementValues,
): Promise<ActionResult<{ id: string; proposalId?: string }>> {
  const parsed = endorsementSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;
  const effective = toDate(data.effectiveDate);
  if (!effective) return { ok: false, error: "Fecha inválida" };
  const endDate = toDate(data.endDate);

  const { ctx, db } = await requireOrgDb();
  const policy = await db.policy.findFirst({
    where: { id: policyId },
    select: {
      id: true,
      policyNumber: true,
      status: true,
      clientId: true,
      proposalId: true,
      companyId: true,
      lineId: true,
      branchId: true,
      productId: true,
      currency: true,
      startDate: true,
      endDate: true,
      premiumNet: true,
      premiumAffect: true,
      premiumExempt: true,
      commissionPercent: true,
      assignedUserId: true,
      salespersonId: true,
    },
  });
  if (!policy) return { ok: false, error: "Póliza no existe." };

  // Se valida al crear para no armar una propuesta que después no se pueda
  // aplicar (se vuelve a validar al despachar).
  const transitionError = endorsementTransitionError(data.type, policy.status);
  if (transitionError) return { ok: false, error: transitionError };

  const clause = policy.proposalId
    ? await db.proposal.findFirst({
        where: { id: policy.proposalId },
        select: { conClausulaInalterabilidad: true },
      })
    : null;
  const spec = specEndorsementOf(data.type);
  let affectedDelta = parsePremiumDelta(data.premiumAffectedDelta);
  let exemptDelta = parsePremiumDelta(data.premiumExemptDelta);
  if (affectedDelta == null && exemptDelta == null) {
    const affect =
      policy.premiumAffect != null ? Number(policy.premiumAffect) : null;
    const exempt =
      policy.premiumExempt != null ? Number(policy.premiumExempt) : null;
    const net = policy.premiumNet != null ? Number(policy.premiumNet) : 0;
    const estimate = endorsementPremium({
      method: spec.calcMethod,
      premium:
        affect != null || exempt != null
          ? { affected: affect ?? 0, exempt: exempt ?? 0 }
          : { affected: net, exempt: 0 },
      periodStart: policy.startDate,
      periodEnd: policy.endDate,
      effective,
      extensionEnd: endDate,
    });
    const fills =
      data.type === "PRORROGA" ||
      data.type === "REVERSO_PRORROGA" ||
      data.type === "REDUCE_VIGENCIA" ||
      data.type === "CORTE_PERDIDA_TOTAL" ||
      endorsementUsesCalculatedCredit(data.type);
    if (estimate && fills) {
      affectedDelta = estimate.affected;
      exemptDelta = estimate.exempt;
    }
  }
  const premiumDelta = (affectedDelta ?? 0) + (exemptDelta ?? 0);
  const creditorAuthorization = await db.document.findFirst({
    where: {
      AND: [
        {
          OR: [
            { entityType: "POLICY", entityId: policy.id },
            ...(policy.proposalId
              ? [{ entityType: "PROPOSAL" as const, entityId: policy.proposalId }]
              : []),
          ],
        },
        {
          OR: [
            { documentType: { equals: "CREDITOR_AUTHORIZATION", mode: "insensitive" as const } },
            { documentType: { contains: "acreedor", mode: "insensitive" as const } },
            { fileName: { contains: "acreedor", mode: "insensitive" as const } },
          ],
        },
      ],
    },
    select: { id: true },
  });
  const clauseDecision = inalterabilityDecision({
    hasClause: Boolean(clause?.conClausulaInalterabilidad),
    specType: spec.code,
    lowersSumInsured: data.type === "MODIFICA_MONTO_PRIMA" && premiumDelta < 0,
    removesLossPayee: false,
    hasCreditorAuthorization: Boolean(creditorAuthorization),
    canOverride: hasPermission(ctx.role, "endorsements.override_inalterability"),
    overrideReason: data.notes,
    recordingWhatInsurerIssued:
      data.mode === "DIRECTO" && data.type === "CANCELACION_NO_PAGO",
  });
  if (clauseDecision.blocked) {
    return {
      ok: false,
      error:
        clauseDecision.code === "REASON_REQUIRED"
          ? "REASON_REQUIRED: para omitir la autorización del acreedor el motivo debe tener al menos 10 caracteres."
          : "PERMISSION_DENIED: la póliza tiene cláusula de inalterabilidad. Falta la autorización del acreedor.",
    };
  }
  const inalterabilityNote = clauseDecision.warnCreditor
    ? "La compañía ya emitió el endoso. Hay que avisar al acreedor."
    : clause?.conClausulaInalterabilidad &&
        hasPermission(ctx.role, "endorsements.override_inalterability") &&
        data.notes.trim().length >= 10
      ? `Excepción de inalterabilidad: ${data.notes.trim()}`
      : null;

  const label = ENDORSEMENT_TYPE_LABELS[data.type];

  if (data.mode === "DIRECTO") {
    const result = await db.$transaction((tx) =>
      applyEndorsementToPolicy(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        policyId,
        type: data.type,
        effectiveDate: effective,
        endDate,
        endorsementNumber: toNullable(data.endorsementNumber),
        detail: toNullable(data.detail),
        notes: toNullable(data.notes),
        proposalId: null,
        premiumAffectedDelta: affectedDelta,
        premiumExemptDelta: exemptDelta,
        inalterabilityNote,
        initiatedBy: data.type === "CANCELACION_NO_PAGO" ? "NON_PAYMENT" : "BROKER",
        newInsuredAmount: parsePremiumDelta(data.newInsuredAmount),
        offsetClaimId: toNullable(data.offsetClaimId),
        commissionAffectPct: parsePremiumDelta(data.commissionAffectPct),
        commissionExemptPct: parsePremiumDelta(data.commissionExemptPct),
        targetItemId: toNullable(data.targetItemId),
        itemDescription: toNullable(data.itemDescription),
      }),
    );
    if (!result.ok) return result;

    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "POLICY",
      entityId: policyId,
      action: "endorsement_created",
      summary: `${label} de póliza ${policy.policyNumber}`,
      userId: ctx.userId,
    });
    if (clauseDecision.warnCreditor) {
      await db.task.create({
        data: {
          organizationId: ctx.organizationId,
          title: "Avisar al acreedor",
          description: inalterabilityNote,
          entityType: "POLICY",
          entityId: policyId,
          assignedUserId: policy.assignedUserId ?? ctx.userId,
          createdById: ctx.userId,
        },
      });
    }
    revalidatePath(`/polizas/${policyId}`);
    return { ok: true, data: { id: result.id } };
  }

  // Propuesta de endoso: hereda de la póliza (y de su propuesta de origen, si
  // la hay) los datos que van en la "Solicitud de Endoso".
  const source = policy.proposalId
    ? await db.proposal.findFirst({
        where: { id: policy.proposalId },
        select: {
          branchTypeId: true,
          insuredClientId: true,
          beneficiaryClientId: true,
          recipientEmail: true,
          recipientContactId: true,
          contratanteEmail: true,
          contratantePhone: true,
          contratanteCelular: true,
          commissionAffectPct: true,
          commissionExemptPct: true,
          startTime: true,
          endTime: true,
        },
      })
    : null;

  try {
    const proposalNumber = await generateProposalNumber(
      basePrisma,
      ctx.organizationId,
    );
    const proposal = await db.$transaction(async (tx) => {
      const created = await tx.proposal.create({
        data: {
          organizationId: ctx.organizationId,
          kind: "ENDOSO",
          endorsedPolicyId: policy.id,
          endorsementType: data.type,
          endorsementDetail: data.detail,
          endorsementPremiumAffected:
            affectedDelta == null ? null : new Prisma.Decimal(affectedDelta.toFixed(4)),
          endorsementPremiumExempt:
            exemptDelta == null ? null : new Prisma.Decimal(exemptDelta.toFixed(4)),
          endorsementNewInsuredAmount:
            parsePremiumDelta(data.newInsuredAmount) == null
              ? null
              : new Prisma.Decimal(parsePremiumDelta(data.newInsuredAmount)!.toFixed(2)),
          endorsementOffsetClaimId: toNullable(data.offsetClaimId),
          endorsementCommissionAffectPct:
            parsePremiumDelta(data.commissionAffectPct) == null
              ? null
              : new Prisma.Decimal(parsePremiumDelta(data.commissionAffectPct)!.toFixed(3)),
          endorsementCommissionExemptPct:
            parsePremiumDelta(data.commissionExemptPct) == null
              ? null
              : new Prisma.Decimal(parsePremiumDelta(data.commissionExemptPct)!.toFixed(3)),
          endorsementTargetItemId: toNullable(data.targetItemId),
          endorsementItemDescription: toNullable(data.itemDescription),
          observations: [toNullable(data.notes), inalterabilityNote]
            .filter(Boolean)
            .join("\n") || null,
          clientId: policy.clientId,
          proposalNumber,
          companyId: policy.companyId,
          lineId: policy.lineId,
          branchId: policy.branchId,
          branchTypeId: source?.branchTypeId ?? null,
          productId: policy.productId,
          insuredClientId: source?.insuredClientId ?? null,
          beneficiaryClientId: source?.beneficiaryClientId ?? null,
          recipientEmail: source?.recipientEmail ?? null,
          recipientContactId: source?.recipientContactId ?? null,
          contratanteEmail: source?.contratanteEmail ?? null,
          contratantePhone: source?.contratantePhone ?? null,
          contratanteCelular: source?.contratanteCelular ?? null,
          commissionAffectPct:
            source?.commissionAffectPct ?? policy.commissionPercent ?? null,
          commissionExemptPct: source?.commissionExemptPct ?? null,
          status: "ELABORACION",
          currency: policy.currency,
          startDate: effective,
          endDate: endDate ?? policy.endDate,
          startTime: source?.startTime ?? null,
          endTime: source?.endTime ?? null,
          assignedUserId: policy.assignedUserId ?? ctx.userId,
          salespersonId: policy.salespersonId,
          currentStateStartedAt: new Date(),
          createdById: ctx.userId,
        },
        select: { id: true, proposalNumber: true },
      });
      await tx.proposalStatusHistory.create({
        data: {
          organizationId: ctx.organizationId,
          proposalId: created.id,
          status: "ELABORACION",
          note: `Propuesta de endoso (${label.toLowerCase()}) de la póliza ${policy.policyNumber}`,
          changedById: ctx.userId,
        },
      });
      await tx.proposalLog.create({
        data: {
          organizationId: ctx.organizationId,
          proposalId: created.id,
          action: "CREATED",
          summary: `Propuesta de endoso creada desde la póliza ${policy.policyNumber}`,
          userId: ctx.userId,
        },
      });
      return created;
    });

    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "POLICY",
      entityId: policyId,
      action: "endorsement_proposal_created",
      summary: `Propuesta de endoso N° ${proposal.proposalNumber} (${label}) de póliza ${policy.policyNumber}`,
      userId: ctx.userId,
    });

    revalidatePath(`/polizas/${policyId}`);
    revalidatePath("/propuestas");
    return { ok: true, data: { id: proposal.id, proposalId: proposal.id } };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Conflicto al numerar la propuesta. Intenta nuevamente.",
      };
    }
    throw error;
  }
}

/** Edita una propuesta de endoso mientras no esté bloqueada. */
export async function updateEndorsementProposalAction(
  proposalId: string,
  raw: EndorsementProposalValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = endorsementProposalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;
  const effective = toDate(data.effectiveDate);
  if (!effective) return { ok: false, error: "Fecha inválida" };

  const { ctx, db } = await requireOrgDb();
  const proposal = await db.proposal.findFirst({
    where: { id: proposalId, kind: "ENDOSO" },
    select: { id: true, status: true, proposalNumber: true },
  });
  if (!proposal) return { ok: false, error: "La propuesta de endoso no existe." };
  if (isProposalLocked(proposal.status)) {
    return {
      ok: false,
      error: "La propuesta está bloqueada. Reábrela para editarla.",
    };
  }

  await db.proposal.update({
    where: { id: proposalId },
    data: {
      endorsementType: data.type,
      endorsementDetail: data.detail,
      endorsementPremiumAffected: deltaDecimal(data.premiumAffectedDelta),
      endorsementPremiumExempt: deltaDecimal(data.premiumExemptDelta),
      endorsementNewInsuredAmount: deltaDecimal(data.newInsuredAmount),
      endorsementOffsetClaimId: toNullable(data.offsetClaimId),
      endorsementCommissionAffectPct: deltaDecimal(data.commissionAffectPct),
      endorsementCommissionExemptPct: deltaDecimal(data.commissionExemptPct),
      endorsementTargetItemId: toNullable(data.targetItemId),
      endorsementItemDescription: toNullable(data.itemDescription),
      startDate: effective,
      endDate: toDate(data.endDate),
      observations: toNullable(data.observations),
    },
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "PROPOSAL",
    entityId: proposalId,
    action: "updated",
    summary: `Propuesta de endoso ${proposal.proposalNumber} actualizada`,
    userId: ctx.userId,
  });
  revalidatePath("/propuestas");
  revalidatePath(`/propuestas/${proposalId}`);
  return { ok: true, data: { id: proposalId } };
}

export async function deleteEndorsementAction(
  endorsementId: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  const endorsement = await db.endorsement.findFirst({
    where: { id: endorsementId },
    select: {
      id: true,
      policyId: true,
      type: true,
      createdAt: true,
      priorSnapshot: true,
    },
  });
  if (!endorsement) return { ok: false, error: "Endoso no existe." };

  const addedItems = (await db.policyItem.findMany({
    where: { addedByEndorsementId: endorsement.id },
    select: { id: true },
  })) as { id: string }[];
  if (addedItems.length > 0) {
    const ids = addedItems.map((item) => item.id);
    const [claims, laterEndorsements] = await Promise.all([
      db.claim.count({ where: { policyItemId: { in: ids } } }),
      db.endorsement.count({
        where: { targetItemId: { in: ids }, NOT: { id: endorsement.id } },
      }),
    ]);
    if (claims > 0 || laterEndorsements > 0) {
      return {
        ok: false,
        error:
          "El ítem que agregó este endoso tiene siniestros o endosos posteriores. Bórralos o reasígnalos primero.",
      };
    }
  }

  await db.$transaction(
    async (tx) => {
      await setTenantGuc(tx as never, ctx.organizationId);
      await deleteEndorsementInTx(tx, endorsement, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
      });
    },
    { timeout: 30_000 },
  );
  revalidatePath(`/polizas/${endorsement.policyId}`);
  return { ok: true };
}
