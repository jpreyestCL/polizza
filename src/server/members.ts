import "server-only";
import { basePrisma } from "@/server/db";

/**
 * Helpers tipados para Member/User que SIEMPRE filtran por organizationId.
 *
 * Las tablas de Better Auth (User, Account, Session, Member, Invitation,
 * Organization) NO están en TENANT_MODELS del extends — son globales en
 * términos de Prisma. Pero `Member` SÍ tiene organizationId y CUALQUIER
 * lectura/escritura desde código de features debe filtrarla.
 *
 * Para evitar bugs silenciosos de cross-tenant en miembros/usuarios, todas
 * las consultas que crucen tenant pasan por estos helpers. Nunca uses
 * basePrisma.member directamente desde src/features/.
 */

export type OrgMember = {
  userId: string;
  name: string;
  email: string;
  role: string;
  memberId: string;
  createdAt: Date;
};

/** Todos los miembros de una organización con datos básicos del usuario. */
export async function listOrgMembers(
  organizationId: string,
): Promise<OrgMember[]> {
  if (!organizationId) {
    throw new Error("listOrgMembers: organizationId requerido");
  }
  const rows = await basePrisma.member.findMany({
    where: { organizationId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((m) => ({
    memberId: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    createdAt: m.createdAt,
  }));
}

/** Una membresía concreta (usuario X en la org Y). Null si no existe. */
export async function getOrgMember(
  organizationId: string,
  userId: string,
): Promise<OrgMember | null> {
  if (!organizationId || !userId) return null;
  const m = await basePrisma.member.findFirst({
    where: { organizationId, userId },
    include: { user: true },
  });
  if (!m) return null;
  return {
    memberId: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    createdAt: m.createdAt,
  };
}

/** Busca un usuario por email DENTRO de una organización. Null si no es miembro. */
export async function getOrgUserByEmail(
  organizationId: string,
  email: string,
): Promise<OrgMember | null> {
  if (!organizationId || !email) return null;
  const m = await basePrisma.member.findFirst({
    where: { organizationId, user: { email } },
    include: { user: true },
  });
  if (!m) return null;
  return {
    memberId: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    createdAt: m.createdAt,
  };
}

/** ¿userId pertenece a organizationId? Defensa en profundidad. */
export async function isOrgMember(
  organizationId: string,
  userId: string,
): Promise<boolean> {
  if (!organizationId || !userId) return false;
  const count = await basePrisma.member.count({
    where: { organizationId, userId },
  });
  return count > 0;
}
