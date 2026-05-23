import "server-only";
import { basePrisma, type Db } from "@/server/db";
import type { SessionContext } from "@/server/context";
import { canSeeAllClients } from "@/lib/roles";

/** Lista de clientes para el listado, acotada por rol. */
export async function listClients(ctx: SessionContext, db: Db) {
  return db.client.findMany({
    where: canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId },
    orderBy: { createdAt: "desc" },
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
}

export type ClientListItem = Awaited<ReturnType<typeof listClients>>[number];

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

export type OrgMember = {
  userId: string;
  name: string;
  email: string;
  role: string;
};

/** Miembros de la organización, para asignar ejecutivos. */
export async function getOrgMembers(
  organizationId: string,
): Promise<OrgMember[]> {
  const members = await basePrisma.member.findMany({
    where: { organizationId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  return members.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
  }));
}
