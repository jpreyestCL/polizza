import "server-only";
import { Prisma } from "@prisma/client";
import { issuePartsFromStored } from "@/lib/domain/issue-parts";
import {
  expectedCommission,
  premiumTotals,
  roundHalfUp,
} from "@/lib/domain/money";

// El cliente extendido no es asignable a un tipo estructural estricto.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

export type LedgerParts = {
  affected: number;
  exempt: number;
  pctAffected?: number | null;
  pctExempt?: number | null;
};

export type LedgerCommission = {
  affected: number;
  exempt: number;
  total: number;
};

/** El reverso conserva el signo contrario de la comisión ya asentada. */
export function negateCommission(row: LedgerCommission): LedgerCommission {
  return {
    affected: roundHalfUp(-row.affected, 4),
    exempt: roundHalfUp(-row.exempt, 4),
    total: roundHalfUp(-row.total, 4),
  };
}

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(roundHalfUp(value, 4).toFixed(4));
}

function day(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Agrega un asiento al libro y la comisión esperada de ese movimiento.
 * Después actualiza la prima vigente de la póliza con la suma del libro.
 */
export async function appendPremiumMovement(
  tx: Tx,
  input: {
    organizationId: string;
    policyId: string;
    endorsementId?: string | null;
    movementType: "ISSUE" | "ENDORSEMENT" | "REVERSAL";
    issuedOn: Date;
    effectiveOn: Date;
    currency: string;
    createdById?: string | null;
    reversesMovementId?: string | null;
    parts: LedgerParts;
    /** Si viene, no se recalcula. El reverso usa la comisión negada del asiento original. */
    commission?: LedgerCommission;
    receivableStatus?: "PENDING" | "VOID" | "SETTLED";
  },
): Promise<void> {
  const totals = premiumTotals({
    affected: input.parts.affected,
    exempt: input.parts.exempt,
  });
  const commission =
    input.commission ??
    expectedCommission(
      { affected: totals.affected, exempt: totals.exempt },
      input.parts.pctAffected ?? 0,
      input.parts.pctExempt ?? 0,
    );
  const last = await tx.premiumMovement.findFirst({
    where: { policyId: input.policyId },
    orderBy: { seqNo: "desc" },
    select: { seqNo: true },
  });
  const created = await tx.premiumMovement.create({
    data: {
      organizationId: input.organizationId,
      policyId: input.policyId,
      endorsementId: input.endorsementId ?? null,
      seqNo: (last?.seqNo ?? -1) + 1,
      movementType: input.movementType,
      issuedOn: day(input.issuedOn),
      effectiveOn: day(input.effectiveOn),
      premiumAffected: money(totals.affected),
      premiumExempt: money(totals.exempt),
      taxAmount: money(totals.vat),
      premiumNet: money(totals.net),
      premiumGross: money(totals.gross),
      commissionAffected: money(commission.affected),
      commissionExempt: money(commission.exempt),
      commissionTotal: money(commission.total),
      currency: input.currency,
      reversesMovementId: input.reversesMovementId ?? null,
      createdById: input.createdById ?? null,
    },
    select: { id: true },
  });
  await tx.commissionReceivable.create({
    data: {
      organizationId: input.organizationId,
      policyId: input.policyId,
      movementId: created.id,
      amount: money(commission.total),
      currency: input.currency,
      status: input.receivableStatus ?? "PENDING",
    },
  });
  await refreshPolicyFromLedger(tx, input.policyId);
}

/** La prima vigente guardada en la póliza pasa a ser la suma del libro. */
export async function refreshPolicyFromLedger(
  tx: Tx,
  policyId: string,
): Promise<void> {
  const rows: {
    premiumAffected: Prisma.Decimal;
    premiumExempt: Prisma.Decimal;
    premiumNet: Prisma.Decimal;
    commissionTotal: Prisma.Decimal;
  }[] = await tx.premiumMovement.findMany({
    where: { policyId },
    select: {
      premiumAffected: true,
      premiumExempt: true,
      premiumNet: true,
      commissionTotal: true,
    },
  });
  const affected = rows.reduce((sum, row) => sum + Number(row.premiumAffected), 0);
  const exempt = rows.reduce((sum, row) => sum + Number(row.premiumExempt), 0);
  const net = rows.reduce((sum, row) => sum + Number(row.premiumNet), 0);
  const commission = rows.reduce((sum, row) => sum + Number(row.commissionTotal), 0);
  await tx.policy.update({
    where: { id: policyId },
    data: {
      premiumAffect: money(affected),
      premiumExempt: money(exempt),
      premiumNet: money(net),
      commissionAmount: money(commission),
    },
  });
}

/**
 * Revierte los asientos de un endoso. Cada reverso es un movimiento nuevo
 * con el signo contrario, para que la suma del libro siga siendo la prima vigente.
 */
export async function reverseEndorsementMovements(
  tx: Tx,
  input: {
    organizationId: string;
    policyId: string;
    endorsementId: string;
    createdById?: string | null;
  },
): Promise<void> {
  const rows: {
    id: string;
    premiumAffected: Prisma.Decimal;
    premiumExempt: Prisma.Decimal;
    commissionAffected: Prisma.Decimal;
    commissionExempt: Prisma.Decimal;
    commissionTotal: Prisma.Decimal;
    currency: string;
    effectiveOn: Date;
  }[] = await tx.premiumMovement.findMany({
    where: { endorsementId: input.endorsementId, movementType: "ENDORSEMENT" },
    select: {
      id: true,
      premiumAffected: true,
      premiumExempt: true,
      commissionAffected: true,
      commissionExempt: true,
      commissionTotal: true,
      currency: true,
      effectiveOn: true,
    },
  });
  for (const row of rows) {
    const already = await tx.premiumMovement.findFirst({
      where: { reversesMovementId: row.id },
      select: { id: true },
    });
    if (already) continue;
    await appendPremiumMovement(tx, {
      organizationId: input.organizationId,
      policyId: input.policyId,
      endorsementId: input.endorsementId,
      movementType: "REVERSAL",
      issuedOn: new Date(),
      effectiveOn: row.effectiveOn,
      currency: row.currency,
      createdById: input.createdById,
      reversesMovementId: row.id,
      receivableStatus: "VOID",
      parts: {
        affected: -Number(row.premiumAffected),
        exempt: -Number(row.premiumExempt),
      },
      commission: negateCommission({
        affected: Number(row.commissionAffected),
        exempt: Number(row.commissionExempt),
        total: Number(row.commissionTotal),
      }),
    });
    await tx.commissionReceivable.updateMany({
      where: { movementId: row.id },
      data: { status: "VOID" },
    });
  }
}

/**
 * Pólizas anteriores a este libro no tienen movimiento 0. Se crea uno
 * con la prima que ya estaba guardada, para que la suma del libro coincida.
 */
export async function ensureIssueMovement(
  tx: Tx,
  policy: {
    id: string;
    organizationId: string;
    premiumAffect: Prisma.Decimal | null;
    premiumExempt: Prisma.Decimal | null;
    premiumNet: Prisma.Decimal | null;
    commissionAffectPct: Prisma.Decimal | null;
    commissionExemptPct: Prisma.Decimal | null;
    currency: string;
    startDate: Date | null;
    createdAt: Date;
  },
): Promise<void> {
  const existing = await tx.premiumMovement.findFirst({
    where: { policyId: policy.id, movementType: "ISSUE" },
    select: { id: true },
  });
  if (existing) return;
  const parts = issuePartsFromStored({
    affected:
      policy.premiumAffect != null ? Number(policy.premiumAffect) : null,
    exempt: policy.premiumExempt != null ? Number(policy.premiumExempt) : null,
    net: policy.premiumNet != null ? Number(policy.premiumNet) : 0,
  });
  if (!parts) return;
  await appendPremiumMovement(tx, {
    organizationId: policy.organizationId,
    policyId: policy.id,
    movementType: "ISSUE",
    issuedOn: policy.createdAt,
    effectiveOn: policy.startDate ?? policy.createdAt,
    currency: policy.currency,
    parts: {
      ...parts,
      pctAffected: policy.commissionAffectPct
        ? Number(policy.commissionAffectPct)
        : 0,
      pctExempt: policy.commissionExemptPct
        ? Number(policy.commissionExemptPct)
        : 0,
    },
  });
}

/** Crea el movimiento de emisión si la póliza es anterior al libro. */
export async function backfillPolicyIssueMovement(
  tx: Tx,
  policyId: string,
): Promise<void> {
  const policy = await tx.policy.findFirst({
    where: { id: policyId },
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
}

/**
 * Completa el movimiento 0 de pólizas que ya tenían prima guardada
 * y todavía no entraron al libro. Tope por llamada para no bloquear la página.
 */
export async function backfillMissingIssueMovements(
  tx: Tx,
  limit = 200,
): Promise<number> {
  const policies: {
    id: string;
    organizationId: string;
    premiumAffect: Prisma.Decimal | null;
    premiumExempt: Prisma.Decimal | null;
    premiumNet: Prisma.Decimal | null;
    commissionAffectPct: Prisma.Decimal | null;
    commissionExemptPct: Prisma.Decimal | null;
    currency: string;
    startDate: Date | null;
    createdAt: Date;
  }[] = await tx.policy.findMany({
    where: {
      premiumMovements: { none: { movementType: "ISSUE" } },
      OR: [
        { premiumNet: { not: null } },
        { premiumAffect: { not: null } },
        { premiumExempt: { not: null } },
      ],
    },
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
    take: limit,
  });
  let created = 0;
  for (const policy of policies) {
    const before = await tx.premiumMovement.count({
      where: { policyId: policy.id, movementType: "ISSUE" },
    });
    await ensureIssueMovement(tx, policy);
    const after = await tx.premiumMovement.count({
      where: { policyId: policy.id, movementType: "ISSUE" },
    });
    if (after > before) created += 1;
  }
  return created;
}
