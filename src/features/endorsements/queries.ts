import "server-only";
import type { Db } from "@/server/db";

export type EndorsementRow = {
  id: string;
  type: string;
  effectiveDate: Date;
  reason: string | null;
  notes: string | null;
  createdAt: Date;
};

export async function listPolicyEndorsements(
  db: Db,
  policyId: string,
): Promise<EndorsementRow[]> {
  const rows = await db.endorsement.findMany({
    where: { policyId },
    orderBy: { effectiveDate: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    effectiveDate: r.effectiveDate,
    reason: r.reason,
    notes: r.notes,
    createdAt: r.createdAt,
  }));
}
