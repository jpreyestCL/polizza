import "server-only";
import type { Db } from "@/server/db";

export async function listPrivacyRequests(db: Db) {
  return db.dataSubjectRequest.findMany({
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    include: { client: { select: { name: true, rut: true } } },
  });
}

export async function listPrivacyClients(db: Db) {
  return db.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, rut: true },
    take: 500,
  });
}
