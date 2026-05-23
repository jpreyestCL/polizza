import "server-only";
import type { Db } from "@/server/db";

export async function listBrokers(db: Db) {
  return db.broker.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      rut: true,
      email: true,
      phone: true,
      contactName: true,
      address: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export type BrokerListItem = Awaited<ReturnType<typeof listBrokers>>[number];

export async function listActiveBrokers(db: Db) {
  return db.broker.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, rut: true },
  });
}

export async function getBroker(db: Db, id: string) {
  return db.broker.findFirst({ where: { id } });
}
