import "server-only";
import type { Db } from "@/server/db";

export async function getPaymentPlan(db: Db, proposalId: string) {
  const plan = await db.paymentPlan.findUnique({
    where: { proposalId },
  });
  if (!plan) return null;
  const installments = await db.installment.findMany({
    where: { paymentPlanId: plan.id },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      amount: true,
      dueDate: true,
      status: true,
      currency: true,
    },
  });
  return {
    ...plan,
    installments: installments.map((row) => ({
      ...row,
      amount: Number(row.amount),
    })),
  };
}

export async function listProposalLogs(db: Db, proposalId: string) {
  return db.proposalLog.findMany({
    where: { proposalId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
