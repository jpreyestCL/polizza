import "server-only";
import type { ProposalStatus } from "@prisma/client";
import type { Db } from "@/server/db";

export type EndorsementRow = {
  id: string;
  type: string;
  effectiveDate: Date;
  endDate: Date | null;
  endorsementNumber: string | null;
  detail: string | null;
  reason: string | null;
  notes: string | null;
  createdAt: Date;
  proposal: { id: string; proposalNumber: string } | null;
};

export async function listPolicyEndorsements(
  db: Db,
  policyId: string,
): Promise<EndorsementRow[]> {
  const rows = await db.endorsement.findMany({
    where: { policyId },
    orderBy: { effectiveDate: "desc" },
    include: { proposal: { select: { id: true, proposalNumber: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    effectiveDate: r.effectiveDate,
    endDate: r.endDate,
    endorsementNumber: r.endorsementNumber,
    detail: r.detail,
    reason: r.reason,
    notes: r.notes,
    createdAt: r.createdAt,
    proposal: r.proposal,
  }));
}

export type EndorsementProposalRow = {
  id: string;
  proposalNumber: string;
  status: ProposalStatus;
  endorsementType: string | null;
  startDate: Date | null;
  createdAt: Date;
};

/**
 * Propuestas de endoso de la póliza que siguen en proceso (aún no despachadas,
 * es decir, sin endoso registrado).
 */
export async function listPolicyEndorsementProposals(
  db: Db,
  policyId: string,
): Promise<EndorsementProposalRow[]> {
  return db.proposal.findMany({
    where: {
      kind: "ENDOSO",
      endorsedPolicyId: policyId,
      dispatchedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      proposalNumber: true,
      status: true,
      endorsementType: true,
      startDate: true,
      createdAt: true,
    },
  });
}
