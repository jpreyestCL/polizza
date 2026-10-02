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
import { specEndorsementOf } from "@/lib/domain/endorsement-catalog";

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
  inalterabilityNote?: string | null;
  initiatedBy?: string | null;
  newInsuredAmount?: number | null;
  offsetClaimId?: string | null;
  commissionAffectPct?: number | null;
  commissionExemptPct?: number | null;
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
    select: {
      id: true,
      status: true,
      endDate: true,
      terminationBalance: true,
      commissionAffectPct: true,
      commissionExemptPct: true,
      _count: { select: { items: true } },
    },
  })) as {
    id: string;
    status: string;
    endDate: Date | null;
    terminationBalance: { toString(): string } | null;
    commissionAffectPct: { toString(): string } | null;
    commissionExemptPct: { toString(): string } | null;
    _count: { items: number };
  } | null;
  if (!policy) return { ok: false, error: "La póliza no existe." };

  const transitionError = endorsementTransitionError(input.type, policy.status);
  if (transitionError) return { ok: false, error: transitionError };
  if (input.type === "CORTE_PERDIDA_TOTAL" && input.offsetClaimId) {
    const claim = await tx.claim.findFirst({
      where: { id: input.offsetClaimId, policyId: input.policyId },
      select: { id: true },
    });
    if (!claim) {
      return { ok: false, error: "El siniestro no pertenece a esta póliza." };
    }
  }
  if (terminationKindOf(input.type) && policy.terminationBalance != null) {
    return {
      ok: false,
      error:
        "Ya hay un saldo de término. Otro endoso de cancelación o anulación no lo reemplaza.",
    };
  }

  const spec = specEndorsementOf(input.type);
  const items = (await tx.policyItem.findMany({
    where: { policyId: input.policyId },
    select: { id: true, insuredAmount: true },
  })) as { id: string; insuredAmount: { toString(): string } | null }[];
  const singleItem = items.length === 1 ? items[0] : null;
  const priorSnapshot = {
    status: policy.status,
    endDate: policy.endDate ? policy.endDate.toISOString().slice(0, 10) : null,
    commissionAffectPct: policy.commissionAffectPct?.toString() ?? null,
    commissionExemptPct: policy.commissionExemptPct?.toString() ?? null,
    itemId: singleItem?.id ?? null,
    insuredAmount: singleItem?.insuredAmount?.toString() ?? null,
  };
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
      specType: spec.code,
      calcMethod: spec.calcMethod,
      initiatedBy:
        input.initiatedBy ??
        (input.type === "CANCELACION_NO_PAGO" ? "NON_PAYMENT" : "BROKER"),
      inalterabilityNote: input.inalterabilityNote ?? null,
      newInsuredAmount:
        input.newInsuredAmount != null
          ? new Prisma.Decimal(input.newInsuredAmount.toFixed(2))
          : null,
      offsetClaimId: input.offsetClaimId ?? null,
      commissionAffectPct:
        input.commissionAffectPct != null
          ? new Prisma.Decimal(input.commissionAffectPct.toFixed(3))
          : null,
      commissionExemptPct:
        input.commissionExemptPct != null
          ? new Prisma.Decimal(input.commissionExemptPct.toFixed(3))
          : null,
      priorSnapshot,
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

  const totalLoss = input.type === "CORTE_PERDIDA_TOTAL";
  const nextStatus = totalLoss
    ? policy._count.items <= 1
      ? "CANCELADA"
      : null
    : endorsementStatusEffect(input.type);
  if (input.type === "PRORROGA" && input.endDate) {
    await tx.policy.update({
      where: { id: input.policyId },
      data: { endDate: input.endDate },
    });
  }
  if (
    (input.type === "REDUCE_VIGENCIA" || input.type === "REVERSO_PRORROGA") &&
    (input.endDate || input.effectiveDate)
  ) {
    await tx.policy.update({
      where: { id: input.policyId },
      data: { endDate: input.endDate ?? input.effectiveDate },
    });
  }
  if (input.type === "CAMBIO_COMISION") {
    await tx.policy.update({
      where: { id: input.policyId },
      data: {
        ...(input.commissionAffectPct != null
          ? {
              commissionAffectPct: new Prisma.Decimal(
                input.commissionAffectPct.toFixed(3),
              ),
            }
          : {}),
        ...(input.commissionExemptPct != null
          ? {
              commissionExemptPct: new Prisma.Decimal(
                input.commissionExemptPct.toFixed(3),
              ),
            }
          : {}),
      },
    });
  }
  if (input.type === "MODIFICA_MONTO_PRIMA" && input.newInsuredAmount != null) {
    const items = (await tx.policyItem.findMany({
      where: { policyId: input.policyId },
      select: { id: true },
    })) as { id: string }[];
    if (items.length === 1) {
      await tx.policyItem.update({
        where: { id: items[0].id },
        data: {
          insuredAmount: new Prisma.Decimal(input.newInsuredAmount.toFixed(2)),
        },
      });
    }
  }
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
  if (!terminationKindOf(input.type) && !totalLoss) {
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

type PriorSnapshot = {
  status?: string;
  endDate?: string | null;
  commissionAffectPct?: string | null;
  commissionExemptPct?: string | null;
  itemId?: string | null;
  insuredAmount?: string | null;
};

const TERM_DATE_TYPES = ["PRORROGA", "REDUCE_VIGENCIA", "REVERSO_PRORROGA"] as const;
const STATUS_TYPES = [
  "ANULACION_ENDOSO",
  "ANULACION_COMPANIA",
  "SOLICITUD_ANULACION",
  "CANCELACION_COMPANIA",
  "CANCELACION_NO_PAGO",
  "SOLICITUD_CANCELACION",
  "CORTE_PERDIDA_TOTAL",
] as const;

function asSnapshot(value: unknown): PriorSnapshot | null {
  if (!value || typeof value !== "object") return null;
  return value as PriorSnapshot;
}

function dayOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

/**
 * Devuelve vigencia, comisión, monto del ítem y estado que este endoso
 * cambió, si ningún endoso posterior volvió a tocar lo mismo.
 */
export async function restoreEndorsementSideEffects(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  endorsement: {
    id: string;
    policyId: string;
    type: string;
    createdAt: Date;
    priorSnapshot: unknown;
  },
  user: { organizationId: string; userId: string },
): Promise<void> {
  const snap = asSnapshot(endorsement.priorSnapshot);
  if (!snap) return;
  const later = (types: readonly string[]) =>
    db.endorsement.count({
      where: {
        policyId: endorsement.policyId,
        NOT: { id: endorsement.id },
        createdAt: { gt: endorsement.createdAt },
        type: { in: [...types] },
      },
    }) as Promise<number>;

  if (
    (TERM_DATE_TYPES as readonly string[]).includes(endorsement.type) &&
    (await later(TERM_DATE_TYPES)) === 0
  ) {
    await db.policy.update({
      where: { id: endorsement.policyId },
      data: { endDate: dayOrNull(snap.endDate) },
    });
  }
  if (endorsement.type === "CAMBIO_COMISION" && (await later(["CAMBIO_COMISION"])) === 0) {
    await db.policy.update({
      where: { id: endorsement.policyId },
      data: {
        commissionAffectPct:
          snap.commissionAffectPct != null
            ? new Prisma.Decimal(snap.commissionAffectPct)
            : null,
        commissionExemptPct:
          snap.commissionExemptPct != null
            ? new Prisma.Decimal(snap.commissionExemptPct)
            : null,
      },
    });
  }
  if (
    endorsement.type === "MODIFICA_MONTO_PRIMA" &&
    snap.itemId &&
    (await later(["MODIFICA_MONTO_PRIMA"])) === 0
  ) {
    await db.policyItem.update({
      where: { id: snap.itemId },
      data: {
        insuredAmount:
          snap.insuredAmount != null ? new Prisma.Decimal(snap.insuredAmount) : null,
      },
    }).catch(() => null);
  }
  if (
    endorsement.type === "CORTE_PERDIDA_TOTAL" &&
    snap.status &&
    snap.status !== "CANCELADA" &&
    (await later(STATUS_TYPES)) === 0
  ) {
    const current = (await db.policy.findFirst({
      where: { id: endorsement.policyId },
      select: { status: true },
    })) as { status: string } | null;
    if (current?.status === "CANCELADA") {
      await db.policy.update({
        where: { id: endorsement.policyId },
        data: { status: snap.status },
      });
      await db.policyStatusHistory.create({
        data: {
          organizationId: user.organizationId,
          policyId: endorsement.policyId,
          status: snap.status,
          note: "Endoso de pérdida total revertido",
          changedById: user.userId,
        },
      });
    }
  }
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
      proposalId: true,
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
  // Pólizas emitidas antes de copiar la comisión a la cartera no tienen el
  // porcentaje. El endoso usa el de la propuesta de origen para no dejar la
  // comisión en cero.
  const source =
    policy.commissionAffectPct == null || policy.commissionExemptPct == null
      ? await tx.proposal.findFirst({
          where: { id: policy.proposalId ?? "" },
          select: { commissionAffectPct: true, commissionExemptPct: true },
        })
      : null;
  const pctAffected =
    policy.commissionAffectPct != null
      ? Number(policy.commissionAffectPct)
      : source?.commissionAffectPct != null
        ? Number(source.commissionAffectPct)
        : 0;
  const pctExempt =
    policy.commissionExemptPct != null
      ? Number(policy.commissionExemptPct)
      : source?.commissionExemptPct != null
        ? Number(source.commissionExemptPct)
        : 0;
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
      pctAffected,
      pctExempt,
    },
  });
}
