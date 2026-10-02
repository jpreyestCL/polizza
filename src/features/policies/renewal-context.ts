import "server-only";
import type { Db } from "@/server/db";
import {
  deriveRenewalStatus,
  type PolicyStatusCode,
  type RenewalStatus,
} from "@/lib/domain/renewal-status";
import { successorState } from "@/lib/domain/successor";

export type RenewalSource = {
  id: string;
  status: PolicyStatusCode;
  endDate: Date | null;
  notRenewable: boolean;
  nonRenewalAt: Date | null;
  productRenewable: boolean | null;
};

export async function renewalStatusByPolicy(
  db: Db,
  rows: RenewalSource[],
  now: Date = new Date(),
): Promise<Map<string, RenewalStatus>> {
  const ids = rows.map((row) => row.id);
  const result = new Map<string, RenewalStatus>();
  if (ids.length === 0) return result;

  const [children, proposals] = await Promise.all([
    db.policy.findMany({
      where: { previousPolicyId: { in: ids } },
      select: { previousPolicyId: true, status: true },
    }),
    db.proposal.findMany({
      where: { previousPolicyId: { in: ids }, kind: "POLIZA" },
      select: { previousPolicyId: true, status: true },
    }),
  ]);

  const childStatuses = new Map<string, string[]>();
  for (const child of children) {
    if (!child.previousPolicyId) continue;
    const list = childStatuses.get(child.previousPolicyId) ?? [];
    list.push(child.status);
    childStatuses.set(child.previousPolicyId, list);
  }
  const proposalStatuses = new Map<string, string[]>();
  for (const proposal of proposals) {
    if (!proposal.previousPolicyId) continue;
    const list = proposalStatuses.get(proposal.previousPolicyId) ?? [];
    list.push(proposal.status);
    proposalStatuses.set(proposal.previousPolicyId, list);
  }

  for (const row of rows) {
    result.set(
      row.id,
      deriveRenewalStatus({
        policyStatus: row.status,
        endDate: row.endDate,
        notRenewable: row.notRenewable || row.productRenewable === false,
        nonRenewalRecorded: row.nonRenewalAt != null,
        successor: successorState({
          childStatuses: childStatuses.get(row.id) ?? [],
          proposalStatuses: proposalStatuses.get(row.id) ?? [],
        }),
        now,
      }),
    );
  }
  return result;
}
