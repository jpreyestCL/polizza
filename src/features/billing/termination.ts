import "server-only";
import { Prisma, type EndorsementType } from "@prisma/client";
import { terminationResult, type TerminationKind } from "@/lib/domain/termination";
import {
  appendPremiumMovement,
  ensureIssueMovement,
  reverseEndorsementMovements,
} from "@/features/ledger/record";

const ANNULMENT_TYPES = new Set<EndorsementType>([
  "ANULACION_ENDOSO",
  "ANULACION_COMPANIA",
  "SOLICITUD_ANULACION",
]);

const CANCELLATION_TYPES = new Set<EndorsementType>([
  "CANCELACION_COMPANIA",
  "CANCELACION_NO_PAGO",
  "SOLICITUD_CANCELACION",
]);

export function terminationKindOf(type: EndorsementType): TerminationKind | null {
  if (ANNULMENT_TYPES.has(type)) return "ANNULMENT";
  if (CANCELLATION_TYPES.has(type)) return "CANCELLATION";
  return null;
}

// El cliente extendido de Prisma no es asignable a un tipo estructural estricto.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

/**
 * Cierra el plan al cancelar o anular: anula las cuotas impagas y deja
 * un único saldo de término. La pérdida total no entra aquí.
 */
export async function closePlanOnTermination(
  tx: Tx,
  input: {
    organizationId: string;
    policyId: string;
    endorsementId: string;
    userId: string;
    kind: TerminationKind;
    effectiveDate: Date;
  },
): Promise<void> {
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
      endDate: true,
      createdAt: true,
    },
  });
  if (!policy) return;

  const plan = await tx.paymentPlan.findFirst({
    where: { policyId: input.policyId },
    select: { id: true },
  });

  const installments: {
    id: string;
    status: string;
    amount: Prisma.Decimal;
    paymentPlanId: string | null;
  }[] = await tx.installment.findMany({
    where: plan
      ? { OR: [{ policyId: input.policyId }, { paymentPlanId: plan.id }] }
      : { policyId: input.policyId },
    select: { id: true, status: true, amount: true, paymentPlanId: true },
  });

  const paid = installments
    .filter((row) => row.status === "PAGADA" || row.status === "PRESUNTA")
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const pendingIds = installments
    .filter((row) => row.status === "PENDIENTE" || row.status === "RECHAZADA")
    .map((row) => row.id);

  const affect =
    policy.premiumAffect != null ? Number(policy.premiumAffect) : null;
  const exempt =
    policy.premiumExempt != null ? Number(policy.premiumExempt) : null;
  const net = policy.premiumNet != null ? Number(policy.premiumNet) : 0;
  const premium =
    affect != null || exempt != null
      ? { affected: affect ?? 0, exempt: exempt ?? 0 }
      : { affected: net, exempt: 0 };

  const result = terminationResult({
    kind: input.kind,
    premium,
    termStart: policy.startDate,
    termEnd: policy.endDate,
    effectiveDate: input.effectiveDate,
    paid,
  });

  await tx.policy.update({
    where: { id: input.policyId },
    data: {
      terminationBalance: new Prisma.Decimal(result.balance.toFixed(4)),
      terminationBalanceIsEstimate: true,
      terminationReason: input.kind,
    },
  });
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
      affected: result.creditAffected,
      exempt: result.creditExempt,
      pctAffected: policy.commissionAffectPct
        ? Number(policy.commissionAffectPct)
        : 0,
      pctExempt: policy.commissionExemptPct
        ? Number(policy.commissionExemptPct)
        : 0,
    },
  });

  if (pendingIds.length > 0) {
    await tx.installment.updateMany({
      where: { id: { in: pendingIds } },
      data: { status: "ANULADA", voidedByTermination: true },
    });
  }

  if (plan) {
    await tx.paymentPlan.update({
      where: { id: plan.id },
      data: {
        terminationBalance: new Prisma.Decimal(result.balance.toFixed(4)),
        terminationBalanceIsEstimate: true,
        closedReason: input.kind,
      },
    });
  }
}

/** Revierte la cascada cuando se borra el último endoso de término. */
export async function reopenPlanAfterTermination(
  tx: Tx,
  input: {
    organizationId: string;
    policyId: string;
    endorsementId: string;
    userId: string;
  },
): Promise<void> {
  const plan = await tx.paymentPlan.findFirst({
    where: { policyId: input.policyId },
    select: { id: true },
  });
  await reverseEndorsementMovements(tx, {
    organizationId: input.organizationId,
    policyId: input.policyId,
    endorsementId: input.endorsementId,
    createdById: input.userId,
  });
  await tx.policy.update({
    where: { id: input.policyId },
    data: {
      terminationBalance: null,
      terminationBalanceIsEstimate: false,
      terminationReason: null,
    },
  });
  await tx.installment.updateMany({
    where: plan
      ? {
          voidedByTermination: true,
          status: "ANULADA",
          OR: [{ policyId: input.policyId }, { paymentPlanId: plan.id }],
        }
      : {
          policyId: input.policyId,
          voidedByTermination: true,
          status: "ANULADA",
        },
    data: { status: "PENDIENTE", voidedByTermination: false },
  });
  if (plan) {
    await tx.paymentPlan.update({
      where: { id: plan.id },
      data: {
        terminationBalance: null,
        terminationBalanceIsEstimate: false,
        closedReason: null,
      },
    });
  }
}
