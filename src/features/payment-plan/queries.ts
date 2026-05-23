import "server-only";
import type { Db } from "@/server/db";

export async function getPaymentPlan(db: Db, proposalId: string) {
  return db.paymentPlan.findUnique({
    where: { proposalId },
    include: {
      // Cuotas asociadas vía paymentPlanId
    },
  });
}

export async function listProposalLogs(db: Db, proposalId: string) {
  return db.proposalLog.findMany({
    where: { proposalId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
