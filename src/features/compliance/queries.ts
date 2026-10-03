import "server-only";
import type { Db } from "@/server/db";

export function listComplianceObligations(db: Db) {
  return db.complianceObligation.findMany({
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
}
