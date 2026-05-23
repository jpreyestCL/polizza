import "server-only";
import type { Db } from "@/server/db";

export type HoldingListItem = {
  id: string;
  name: string;
  notes: string | null;
  clientCount: number;
  createdAt: Date;
};

/** Holdings de la organización con la cantidad de clientes agrupados. */
export async function listHoldings(db: Db): Promise<HoldingListItem[]> {
  const rows = await db.holding.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      notes: true,
      createdAt: true,
      _count: { select: { clients: true } },
    },
  });
  return rows.map((h) => ({
    id: h.id,
    name: h.name,
    notes: h.notes,
    createdAt: h.createdAt,
    clientCount: h._count.clients,
  }));
}

/** Detalle de un holding con sus clientes miembros. */
export async function getHoldingDetail(db: Db, id: string) {
  return db.holding.findFirst({
    where: { id },
    include: {
      clients: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          rut: true,
          type: true,
          status: true,
        },
      },
    },
  });
}

export type HoldingDetail = NonNullable<
  Awaited<ReturnType<typeof getHoldingDetail>>
>;

/** Clientes que aún no pertenecen a ningún holding (para agregarlos). */
export async function listClientsWithoutHolding(db: Db) {
  return db.client.findMany({
    where: { holdingId: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, rut: true },
  });
}
