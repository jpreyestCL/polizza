import "server-only";
import { Prisma, type EndorsementType } from "@prisma/client";
import {
  closePlanOnTermination,
  reopenPlanAfterTermination,
  terminationKindOf,
} from "@/features/billing/termination";
import {
  appendPremiumMovement,
  ensureIssueMovement,
  reverseEndorsementMovements,
} from "@/features/ledger/record";
import { roundHalfUp } from "@/lib/domain/money";
import {
  ENDORSEMENT_TYPE_LABELS,
  ITEM_DESCRIPTION_TYPES,
  ITEM_TARGET_TYPES,
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
  /** Ítem de la póliza al que apunta el endoso. */
  targetItemId?: string | null;
  /** Glosa del ítem que agrega, reemplaza o corrige. */
  itemDescription?: string | null;
  /** Endoso histórico (migración): se registra aunque falten datos del ítem. */
  historical?: boolean;
};

const TERMINATION_TYPES = [
  "ANULACION_ENDOSO",
  "ANULACION_COMPANIA",
  "SOLICITUD_ANULACION",
  "CANCELACION_COMPANIA",
  "CANCELACION_NO_PAGO",
  "SOLICITUD_CANCELACION",
] as const;

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
      currency: true,
      notRenewable: true,
      nonRenewalReason: true,
      nonRenewalNote: true,
      nonRenewalAt: true,
    },
  })) as {
    id: string;
    status: string;
    endDate: Date | null;
    terminationBalance: { toString(): string } | null;
    commissionAffectPct: { toString(): string } | null;
    commissionExemptPct: { toString(): string } | null;
    currency: string;
    notRenewable: boolean;
    nonRenewalReason: string | null;
    nonRenewalNote: string | null;
    nonRenewalAt: Date | null;
  } | null;
  if (!policy) return { ok: false, error: "La póliza no existe." };

  const transitionError =
    input.historical && input.type === "REHABILITACION"
      ? null
      : endorsementTransitionError(input.type, policy.status);
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
    where: { policyId: input.policyId, removedAt: null },
    select: { id: true, description: true, insuredAmount: true },
  })) as {
    id: string;
    description: string;
    insuredAmount: { toString(): string } | null;
  }[];
  let target: (typeof items)[number] | null = null;
  if (ITEM_TARGET_TYPES.includes(input.type)) {
    if (input.targetItemId) {
      target = items.find((item) => item.id === input.targetItemId) ?? null;
      if (!target) {
        return { ok: false, error: "El ítem no está vigente en esta póliza." };
      }
    } else if (items.length === 1) {
      target = items[0];
    } else if (items.length > 1 && !input.historical) {
      return { ok: false, error: "Elige a qué ítem de la póliza apunta el endoso." };
    }
  }
  const description = input.itemDescription?.trim() || null;
  if (
    ITEM_DESCRIPTION_TYPES.includes(input.type) &&
    !description &&
    !input.historical
  ) {
    return { ok: false, error: "Falta la glosa del ítem." };
  }
  if (
    input.type === "MODIFICA_MONTO_PRIMA" &&
    target &&
    input.newInsuredAmount == null &&
    !input.historical
  ) {
    return { ok: false, error: "Falta el nuevo monto asegurado del ítem." };
  }
  const priorSnapshot = {
    status: policy.status,
    endDate: policy.endDate ? policy.endDate.toISOString().slice(0, 10) : null,
    commissionAffectPct: policy.commissionAffectPct?.toString() ?? null,
    commissionExemptPct: policy.commissionExemptPct?.toString() ?? null,
    itemId: target?.id ?? null,
    insuredAmount: target?.insuredAmount?.toString() ?? null,
    itemDescription: target?.description ?? null,
    notRenewable: policy.notRenewable,
    nonRenewalReason: policy.nonRenewalReason,
    nonRenewalNote: policy.nonRenewalNote,
    nonRenewalAt: policy.nonRenewalAt ? policy.nonRenewalAt.toISOString() : null,
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
      targetItemId: target?.id ?? null,
      itemDescription: description,
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
  const removesTarget =
    target != null &&
    (input.type === "ELIMINA_ITEMS" ||
      input.type === "REEMPLAZA_ITEMS" ||
      totalLoss);
  if (removesTarget && target) {
    await tx.policyItem.update({
      where: { id: target.id },
      data: { removedAt: input.effectiveDate, removedByEndorsementId: created.id },
    });
  }
  if (
    (input.type === "AGREGA_ITEMS" || input.type === "REEMPLAZA_ITEMS") &&
    (description || !input.historical)
  ) {
    await tx.policyItem.create({
      data: {
        organizationId: input.organizationId,
        policyId: input.policyId,
        description: description ?? ENDORSEMENT_TYPE_LABELS[input.type],
        insuredAmount:
          input.newInsuredAmount != null
            ? new Prisma.Decimal(input.newInsuredAmount.toFixed(2))
            : null,
        currency: policy.currency,
        addedByEndorsementId: created.id,
      },
    });
  }
  if (input.type === "MODIFICA_MONTO_PRIMA" && target && input.newInsuredAmount != null) {
    await tx.policyItem.update({
      where: { id: target.id },
      data: {
        insuredAmount: new Prisma.Decimal(input.newInsuredAmount.toFixed(2)),
      },
    });
  }
  if (input.type === "MODIFICACION_GLOSA_ITEM" && target && description) {
    await tx.policyItem.update({
      where: { id: target.id },
      data: { description },
    });
  }
  if (input.type === "CAMBIO_CORREDOR") {
    await tx.policy.update({
      where: { id: input.policyId },
      data: {
        notRenewable: true,
        nonRenewalReason: "BROKER_CHANGE",
        nonRenewalNote:
          input.detail ?? "La póliza pasó a otro corredor por endoso.",
        nonRenewalAt: new Date(),
      },
    });
  }
  const remaining = items.length - (removesTarget ? 1 : 0);
  const nextStatus = totalLoss
    ? remaining <= 0
      ? "CANCELADA"
      : null
    : input.type === "REHABILITACION"
      ? policy.status === "CANCELADA" || policy.status === "ANULADA"
        ? "VIGENTE"
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
    await postCommissionChange(tx, {
      organizationId: input.organizationId,
      policyId: input.policyId,
      endorsementId: created.id,
      userId: input.userId,
      effectiveDate: input.effectiveDate,
      currency: policy.currency,
      oldAffectPct: policy.commissionAffectPct,
      oldExemptPct: policy.commissionExemptPct,
      newAffectPct: input.commissionAffectPct ?? null,
      newExemptPct: input.commissionExemptPct ?? null,
    });
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
    if (input.type === "REHABILITACION") {
      const terminations = await activeTerminations(tx, input.policyId, created.id);
      for (const termination of terminations) {
        await reverseEndorsementMovements(tx, {
          organizationId: input.organizationId,
          policyId: input.policyId,
          endorsementId: termination.id,
          createdById: input.userId,
        });
      }
      const latest = terminations[terminations.length - 1];
      if (latest) {
        await reopenPlanAfterTermination(tx, {
          organizationId: input.organizationId,
          policyId: input.policyId,
          endorsementId: latest.id,
          userId: input.userId,
        });
      }
      await tx.endorsement.update({
        where: { id: created.id },
        data: {
          priorSnapshot: {
            ...priorSnapshot,
            reversedTerminationIds: terminations.map((t) => t.id),
          },
        },
      });
    }
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
  if (
    !terminationKindOf(input.type) &&
    !totalLoss &&
    input.type !== "REHABILITACION"
  ) {
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
  itemDescription?: string | null;
  notRenewable?: boolean;
  nonRenewalReason?: string | null;
  nonRenewalNote?: string | null;
  nonRenewalAt?: string | null;
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
  "REHABILITACION",
] as const;

/**
 * Endosos de término que siguen rigiendo: los creados después de la última
 * rehabilitación, en orden. `before` limita a los anteriores a esa fecha.
 */
export async function activeTerminations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  policyId: string,
  excludeId?: string,
  before?: Date,
): Promise<{ id: string; type: EndorsementType; effectiveDate: Date }[]> {
  const lastRehab = (await db.endorsement.findFirst({
    where: {
      policyId,
      type: "REHABILITACION",
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      ...(before ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })) as { createdAt: Date } | null;
  const createdAt = {
    ...(lastRehab ? { gt: lastRehab.createdAt } : {}),
    ...(before ? { lt: before } : {}),
  };
  return db.endorsement.findMany({
    where: {
      policyId,
      type: { in: [...TERMINATION_TYPES] },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, effectiveDate: true },
  });
}

/**
 * Borra un endoso y deshace lo que hizo: efectos sobre la póliza, asientos
 * del libro y, si era el término que regía, estado y plan de pago.
 * Debe correr dentro de una transacción.
 */
export async function deleteEndorsementInTx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  endorsement: {
    id: string;
    policyId: string;
    type: EndorsementType;
    createdAt: Date;
    priorSnapshot: unknown;
  },
  user: { organizationId: string; userId: string },
): Promise<void> {
  await restoreEndorsementSideEffects(tx, endorsement, user);

  const wasActive =
    Boolean(terminationKindOf(endorsement.type)) &&
    (await activeTerminations(tx, endorsement.policyId)).some(
      (t) => t.id === endorsement.id,
    );
  const remaining = wasActive
    ? await activeTerminations(tx, endorsement.policyId, endorsement.id)
    : [];

  if (wasActive) {
    const latest = remaining[remaining.length - 1];
    const status = latest ? endorsementStatusEffect(latest.type) : "VIGENTE";
    const current = (await tx.policy.findFirst({
      where: { id: endorsement.policyId },
      select: { status: true },
    })) as { status: string } | null;
    if (status && current && current.status !== status) {
      await tx.policy.update({
        where: { id: endorsement.policyId },
        data: { status },
      });
      await tx.policyStatusHistory.create({
        data: {
          organizationId: user.organizationId,
          policyId: endorsement.policyId,
          status,
          note:
            status === "VIGENTE"
              ? "Endoso revertido — póliza vuelve a vigente"
              : "Endoso revertido — rige el término anterior",
          changedById: user.userId,
        },
      });
    }
  }

  await reverseEndorsementMovements(tx, {
    organizationId: user.organizationId,
    policyId: endorsement.policyId,
    endorsementId: endorsement.id,
    createdById: user.userId,
  });
  if (wasActive && remaining.length === 0) {
    await reopenPlanAfterTermination(tx, {
      organizationId: user.organizationId,
      policyId: endorsement.policyId,
      endorsementId: endorsement.id,
      userId: user.userId,
    });
  }

  await tx.endorsement.delete({ where: { id: endorsement.id } });
}

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
    const current = (await db.policy.findFirst({
      where: { id: endorsement.policyId },
      select: { premiumAffect: true, premiumExempt: true },
    })) as { premiumAffect: unknown; premiumExempt: unknown } | null;
    const pctA = snap.commissionAffectPct != null ? Number(snap.commissionAffectPct) : null;
    const pctE = snap.commissionExemptPct != null ? Number(snap.commissionExemptPct) : null;
    const affected = current?.premiumAffect != null ? Number(current.premiumAffect) : 0;
    const exempt = current?.premiumExempt != null ? Number(current.premiumExempt) : 0;
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
        commissionAffect: new Prisma.Decimal(
          roundHalfUp((affected * (pctA ?? 0)) / 100, 4).toFixed(4),
        ),
        commissionExempt: new Prisma.Decimal(
          roundHalfUp((exempt * (pctE ?? 0)) / 100, 4).toFixed(4),
        ),
      },
    });
  }
  await db.policyItem.updateMany({
    where: { removedByEndorsementId: endorsement.id },
    data: { removedAt: null, removedByEndorsementId: null },
  });
  await db.policyItem.deleteMany({
    where: { addedByEndorsementId: endorsement.id },
  });
  if (
    endorsement.type === "MODIFICACION_GLOSA_ITEM" &&
    snap.itemId &&
    snap.itemDescription &&
    (await later(["MODIFICACION_GLOSA_ITEM"])) === 0
  ) {
    await db.policyItem.updateMany({
      where: { id: snap.itemId },
      data: { description: snap.itemDescription },
    });
  }
  if (endorsement.type === "CAMBIO_CORREDOR" && (await later(["CAMBIO_CORREDOR"])) === 0) {
    await db.policy.update({
      where: { id: endorsement.policyId },
      data: {
        notRenewable: snap.notRenewable ?? false,
        nonRenewalReason: snap.nonRenewalReason ?? null,
        nonRenewalNote: snap.nonRenewalNote ?? null,
        nonRenewalAt: snap.nonRenewalAt ? new Date(snap.nonRenewalAt) : null,
      },
    });
  }
  if (endorsement.type === "REHABILITACION" && (await later(STATUS_TYPES)) === 0) {
    const recorded = (snap as { reversedTerminationIds?: unknown })
      .reversedTerminationIds;
    const terminations = Array.isArray(recorded)
      ? ((await db.endorsement.findMany({
          where: {
            id: { in: recorded.filter((id): id is string => typeof id === "string") },
          },
          orderBy: { createdAt: "asc" },
          select: { id: true, type: true, effectiveDate: true },
        })) as { id: string; type: EndorsementType; effectiveDate: Date }[])
      : await activeTerminations(db, endorsement.policyId, endorsement.id, endorsement.createdAt);
    const latest = terminations[terminations.length - 1];
    const status = latest ? endorsementStatusEffect(latest.type) : null;
    if (latest && status) {
      await db.policy.update({
        where: { id: endorsement.policyId },
        data: { status },
      });
      await db.policyStatusHistory.create({
        data: {
          organizationId: user.organizationId,
          policyId: endorsement.policyId,
          status,
          note: "Rehabilitación revertida",
          changedById: user.userId,
        },
      });
      for (const termination of terminations) {
        const kind = terminationKindOf(termination.type);
        if (!kind) continue;
        await closePlanOnTermination(db, {
          organizationId: user.organizationId,
          policyId: endorsement.policyId,
          endorsementId: termination.id,
          userId: user.userId,
          kind,
          effectiveDate: termination.effectiveDate,
        });
      }
    }
  }
  if (
    endorsement.type === "MODIFICA_MONTO_PRIMA" &&
    snap.itemId &&
    (await later(["MODIFICA_MONTO_PRIMA"])) === 0
  ) {
    await db.policyItem.updateMany({
      where: { id: snap.itemId },
      data: {
        insuredAmount:
          snap.insuredAmount != null ? new Prisma.Decimal(snap.insuredAmount) : null,
      },
    });
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

/**
 * Cambia el porcentaje de comisión y asienta la diferencia sobre la prima
 * ya registrada. El asiento no mueve prima: solo deja por cobrar (o por
 * devolver) la comisión que cambia.
 */
async function postCommissionChange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  input: {
    organizationId: string;
    policyId: string;
    endorsementId: string;
    userId: string;
    effectiveDate: Date;
    currency: string;
    oldAffectPct: { toString(): string } | null;
    oldExemptPct: { toString(): string } | null;
    newAffectPct: number | null;
    newExemptPct: number | null;
  },
): Promise<void> {
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
  await ensureIssueMovement(tx, policy);
  const oldA = input.oldAffectPct != null ? Number(input.oldAffectPct.toString()) : 0;
  const oldE = input.oldExemptPct != null ? Number(input.oldExemptPct.toString()) : 0;
  const newA = input.newAffectPct ?? oldA;
  const newE = input.newExemptPct ?? oldE;
  const rows = (await tx.premiumMovement.findMany({
    where: { policyId: input.policyId },
    select: { premiumAffected: true, premiumExempt: true },
  })) as { premiumAffected: unknown; premiumExempt: unknown }[];
  const affected = rows.reduce((sum, row) => sum + Number(row.premiumAffected), 0);
  const exempt = rows.reduce((sum, row) => sum + Number(row.premiumExempt), 0);
  const deltaAffected = roundHalfUp((affected * (newA - oldA)) / 100, 4);
  const deltaExempt = roundHalfUp((exempt * (newE - oldE)) / 100, 4);
  await tx.policy.update({
    where: { id: input.policyId },
    data: {
      commissionAffectPct: new Prisma.Decimal(newA.toFixed(3)),
      commissionExemptPct: new Prisma.Decimal(newE.toFixed(3)),
      commissionAffect: new Prisma.Decimal(
        roundHalfUp((affected * newA) / 100, 4).toFixed(4),
      ),
      commissionExempt: new Prisma.Decimal(
        roundHalfUp((exempt * newE) / 100, 4).toFixed(4),
      ),
    },
  });
  if (deltaAffected === 0 && deltaExempt === 0) return;
  await appendPremiumMovement(tx, {
    organizationId: input.organizationId,
    policyId: input.policyId,
    endorsementId: input.endorsementId,
    movementType: "ENDORSEMENT",
    issuedOn: new Date(),
    effectiveOn: input.effectiveDate,
    currency: input.currency,
    createdById: input.userId,
    parts: { affected: 0, exempt: 0 },
    commission: {
      affected: deltaAffected,
      exempt: deltaExempt,
      total: roundHalfUp(deltaAffected + deltaExempt, 4),
    },
  });
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
