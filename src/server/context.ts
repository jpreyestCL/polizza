import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { basePrisma, getDb } from "@/server/db";
import type { AppRole } from "@/lib/permissions";

export type SessionContext = {
  userId: string;
  userName: string;
  email: string;
  organizationId: string;
  organizationName: string;
  organizationTimezone: string;
  role: AppRole;
};

/**
 * Resuelve la sesión actual y la organización del usuario.
 * La organización se determina por su membresía (Member); no se depende de
 * activeOrganizationId. Devuelve null si no hay sesión o membresía.
 * Memoizado por request con React cache().
 */
export const getSessionContext = cache(
  async (): Promise<SessionContext | null> => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;

    const membership = await basePrisma.member.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      include: { organization: true },
    });
    if (!membership) return null;

    return {
      userId: session.user.id,
      userName: session.user.name,
      email: session.user.email,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      organizationTimezone:
        membership.organization.timezone ?? "America/Santiago",
      role: (membership.role as AppRole) ?? "ejecutivo",
    };
  },
);

/** Exige sesión válida; redirige a /login si no la hay. */
export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** Sesión + cliente Prisma acotado a la organización del usuario. */
export async function requireOrgDb() {
  const ctx = await requireSession();
  return { ctx, db: getDb(ctx.organizationId) };
}

/**
 * Resuelve sesión y exige que el usuario sea SaaS-superadmin
 * (flag User.isSuperadmin). Para uso en rutas /admin/* que administran
 * catálogos globales (compañías, ramos, productos). Las tablas globales
 * no llevan organizationId, por eso devolvemos basePrisma.
 */
export async function requireSuperadmin() {
  const ctx = await requireSession();
  const user = await basePrisma.user.findUnique({
    where: { id: ctx.userId },
    select: { isSuperadmin: true },
  });
  if (!user?.isSuperadmin) {
    redirect("/panel");
  }
  return { ctx, prisma: basePrisma };
}

/** ¿El usuario logueado es superadmin? Devuelve false si no hay sesión. */
export async function isSuperadminUser(): Promise<boolean> {
  const ctx = await getSessionContext();
  if (!ctx) return false;
  const user = await basePrisma.user.findUnique({
    where: { id: ctx.userId },
    select: { isSuperadmin: true },
  });
  return Boolean(user?.isSuperadmin);
}
