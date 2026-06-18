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

export type ClientListFilters = {
  /** Texto libre: busca en nombre y RUT (insensitive). */
  q?: string;
  type?: "PERSONA" | "EMPRESA";
  status?: import("@prisma/client").ClientStatus;
  /** Único ordenable server-side por ahora: la columna Cliente (name). */
  sort?: "name";
  order?: "asc" | "desc";
};

/** Lista paginada de clientes, acotada por rol y filtros. Cursor sobre id. */
export async function listClients(
  ctx: SessionContext,
  db: Db,
  page: PageParams,
  filters: ClientListFilters = {},
): Promise<Paginated<ClientListItem>> {
  const q = filters.q?.trim();
  // El RUT se almacena normalizado (sin puntos, con guion). Limpiamos el
  // término para que "7.051.978-K" o "7.051.978" matcheen contra "7051978-K".
  const rutQ = q ? q.replace(/[.\s]/g, "") : undefined;
  const where = {
    ...(canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { rut: { contains: rutQ, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
  const order = filters.order === "desc" ? ("desc" as const) : ("asc" as const);
  const orderBy =
    filters.sort === "name"
      ? [{ name: order }, { id: order }]
      : [{ createdAt: "desc" as const }, { id: "desc" as const }];
  const [rows, total] = await Promise.all([
    db.client.findMany({
      where,
      orderBy,
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
 * Busca un cliente por RUT (o nombre) devolviendo los campos necesarios para
 * autocompletar los datos del pagador en el plan de pago. Tenant-safe.
 */
export async function findClientForPayer(
  ctx: SessionContext,
  db: Db,
  query: string,
) {
  const q = query.trim();
  if (!q) return null;
  const baseWhere = canSeeAllClients(ctx.role)
    ? {}
    : { assignedUserId: ctx.userId };
  return db.client.findFirst({
    where: {
      ...baseWhere,
      OR: [
        { rut: { contains: q, mode: "insensitive" as const } },
        { name: { contains: q, mode: "insensitive" as const } },
      ],
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      rut: true,
      name: true,
      firstName: true,
      lastNamePaterno: true,
      legalName: true,
      phone: true,
      celular: true,
      email: true,
    },
  });
}

/**
 * Re-export por compatibilidad. La fuente de verdad vive en
 * src/server/members.ts (tenant-safe, prohíbe lecturas cross-tenant).
 */
export type { OrgMember } from "@/server/members";
export const getOrgMembers = listOrgMembers;
