import "server-only";
import { Prisma, type EndorsementType } from "@prisma/client";
import {
  closePlanOnTermination,
  terminationKindOf,
} from "@/features/billing/termination";
import {
  appendPremiumMovement,
  ensureIssueMovement,
} from "@/features/ledger/record";
import {
  ENDORSEMENT_TYPE_LABELS,
  endorsementStatusEffect,
  endorsementTransitionError,
} from "./schemas";

export type ApplyEndorsementInput = {
  organizationId: string;
  userId: string;
  policyId: string;
  type: EndorsementType;
  effectiveDate: Date;
  endDate: Date | null;
  endorsementNumber: string | null;
  detail: string | null;
  notes: string | null;
  /** Propuesta de endoso que lo origina (null = registro directo). */
  proposalId: string | null;
  /** Delta de prima. Se ignora en cancelación y anulación. */
  premiumAffectedDelta?: number | null;
  premiumExemptDelta?: number | null;
};

/** Día puro (columna Date, en UTC) como dd-mm-aaaa. */
function formatDay(date: Date): string {
  const [y, m, d] = date.toISOString().slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

/**
 * Registra un endoso en la póliza y aplica su efecto sobre el estado
 * (cancelación / anulación). Se usa tanto en el registro directo como al
 * despachar una propuesta de endoso. Debe correr dentro de una transacción.
 */
// El tx del cliente extendido (`getDb`) no es asignable a
// Prisma.TransactionClient; mismo criterio que replaceParticipations.
export async function applyEndorsementToPolicy(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  input: ApplyEndorsementInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const policy = (await tx.policy.findFirst({
    where: { id: input.policyId },
    select: { id: true, status: true },
  })) as { id: string; status: string } | null;
  if (!policy) return { ok: false, error: "La póliza no existe." };

  const transitionError = endorsementTransitionError(input.type, policy.status);
  if (transitionError) return { ok: false, error: transitionError };

  const created = (await tx.endorsement.create({
    data: {
      organizationId: input.organizationId,
      policyId: input.policyId,
      type: input.type,
      effectiveDate: input.effectiveDate,
      endDate: input.endDate,
      endorsementNumber: input.endorsementNumber,
      detail: input.detail,
      notes: input.notes,
      proposalId: input.proposalId,
      premiumAffectedDelta:
        input.premiumAffectedDelta != null
          ? new Prisma.Decimal(input.premiumAffectedDelta.toFixed(4))
          : null,
      premiumExemptDelta:
        input.premiumExemptDelta != null
          ? new Prisma.Decimal(input.premiumExemptDelta.toFixed(4))
          : null,
      createdById: input.userId,
    },
    select: { id: true },
  })) as { id: string };

  const nextStatus = endorsementStatusEffect(input.type);
  if (nextStatus) {
    await tx.policy.update({
      where: { id: input.policyId },
      data: { status: nextStatus },
    });
    await tx.policyStatusHistory.create({
      data: {
        organizationId: input.organizationId,
        policyId: input.policyId,
        status: nextStatus,
        // El estado cambia al registrar el endoso emitido, pero rige desde la
        // fecha de inicio del endoso.
        note: `Endoso de ${ENDORSEMENT_TYPE_LABELS[input.type].toLowerCase()}${
          input.endorsementNumber ? ` N° ${input.endorsementNumber}` : ""
        } · vigente desde ${formatDay(input.effectiveDate)}`,
        changedById: input.userId,
      },
    });
    const kind = terminationKindOf(input.type);
    if (kind) {
      await closePlanOnTermination(tx, {
        organizationId: input.organizationId,
        policyId: input.policyId,
        endorsementId: created.id,
        userId: input.userId,
        kind,
        effectiveDate: input.effectiveDate,
      });
    }
  }
  if (!terminationKindOf(input.type)) {
    await postPremiumDelta(tx, {
      organizationId: input.organizationId,
      policyId: input.policyId,
      endorsementId: created.id,
      userId: input.userId,
      effectiveDate: input.effectiveDate,
      affected: input.premiumAffectedDelta ?? 0,
      exempt: input.premiumExemptDelta ?? 0,
    });
  }
  return { ok: true, id: created.id };
}

async function postPremiumDelta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  input: {
    organizationId: string;
    policyId: string;
    endorsementId: string;
    userId: string;
    effectiveDate: Date;
    affected: number;
    exempt: number;
  },
): Promise<void> {
  if (input.affected === 0 && input.exempt === 0) return;
  const policy = await tx.policy.findFirst({
    where: { id: input.policyId },
    select: {
      id: true,
      organizationId: true,
      premiumAffect: true,
      premiumExempt: true,
      premiumNet: true,
      commissionAffectPct: true,
      commissionExemptPct: true,
      currency: true,
      startDate: true,
      createdAt: true,
    },
  });
  if (!policy) return;
  await ensureIssueMovement(tx, policy);
  await appendPremiumMovement(tx, {
    organizationId: input.organizationId,
    policyId: input.policyId,
    endorsementId: input.endorsementId,
    movementType: "ENDORSEMENT",
    issuedOn: new Date(),
    effectiveOn: input.effectiveDate,
    currency: policy.currency,
    createdById: input.userId,
    parts: {
      affected: input.affected,
      exempt: input.exempt,
      pctAffected: policy.commissionAffectPct
        ? Number(policy.commissionAffectPct)
        : 0,
      pctExempt: policy.commissionExemptPct
        ? Number(policy.commissionExemptPct)
        : 0,
    },
  });
}
