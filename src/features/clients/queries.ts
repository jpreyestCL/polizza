import "server-only";
import { type Db } from "@/server/db";
import type { SessionContext } from "@/server/context";
import { canSeeAllClients } from "@/lib/roles";
import {
  buildPaginated,
  cursorArgs,
  type PageParams,
  type Paginated,
} from "@/lib/pagination";
import { listOrgMembers } from "@/server/members";

/** Lista paginada de clientes, acotada por rol. Cursor sobre id. */
export async function listClients(
  ctx: SessionContext,
  db: Db,
  page: PageParams,
): Promise<Paginated<ClientListItem>> {
  const where = canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId };
  const [rows, total] = await Promise.all([
    db.client.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorArgs(page),
      select: {
        id: true,
        type: true,
        rut: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        region: true,
        commune: true,
        assignedUserId: true,
        createdAt: true,
        _count: { select: { contacts: true, policies: true, proposals: true } },
      },
    }),
    db.client.count({ where }),
  ]);
  return buildPaginated(rows, page, total);
}

export type ClientListItem = {
  id: string;
  type: "PERSONA" | "EMPRESA";
  rut: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: import("@prisma/client").ClientStatus;
  region: string | null;
  commune: string | null;
  assignedUserId: string | null;
  createdAt: Date;
  _count: { contacts: number; policies: number; proposals: number };
};

/**
 * Lista plana de clientes para selects/comboboxes en formularios. Limitada a
 * 500 filas — los formularios deben usar `searchClients` para datasets más
 * grandes. NO usar para listados de UI; usar `listClients` con cursor.
 */
export async function listClientsForSelect(
  ctx: SessionContext,
  db: Db,
): Promise<ClientListItem[]> {
  const where = canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId };
  const rows = await db.client.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 500,
    select: {
      id: true,
      type: true,
      rut: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      region: true,
      commune: true,
      assignedUserId: true,
      createdAt: true,
      _count: { select: { contacts: true, policies: true, proposals: true } },
    },
  });
  return rows;
}

/** Detalle completo de un cliente para la ficha 360°. */
export async function getClientDetail(db: Db, id: string) {
  return db.client.findFirst({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      tagAssignments: { include: { tag: true } },
      relationships: true,
      _count: { select: { policies: true, proposals: true } },
    },
  });
}

export type ClientDetail = NonNullable<
  Awaited<ReturnType<typeof getClientDetail>>
>;

/** Bitácora de actividad de un cliente. */
export async function getClientActivity(db: Db, clientId: string) {
  return db.activityLog.findMany({
    where: { entityType: "CLIENT", entityId: clientId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/** Búsqueda incremental de clientes por nombre o RUT, acotada por rol. */
export async function searchClients(
  ctx: SessionContext,
  db: Db,
  query: string,
  limit = 20,
) {
  const q = query.trim();
  const baseWhere = canSeeAllClients(ctx.role)
    ? {}
    : { assignedUserId: ctx.userId };
  const rows = await db.client.findMany({
    where: {
      ...baseWhere,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { rut: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, name: true, rut: true },
  });
  return rows;
}

/**
 * Re-export por compatibilidad. La fuente de verdad vive en
 * src/server/members.ts (tenant-safe, prohíbe lecturas cross-tenant).
 */
export type { OrgMember } from "@/server/members";
export const getOrgMembers = listOrgMembers;
