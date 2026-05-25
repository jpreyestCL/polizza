import "server-only";
import type { PolicyStatus } from "@prisma/client";
import type { SessionContext } from "@/server/context";
import type { Db } from "@/server/db";
import { canSeeAllClients } from "@/lib/roles";
import { needsRenewal, renewalInfo, type RenewalLevel } from "@/lib/renewal";
import {
  buildPaginated,
  cursorArgs,
  type PageParams,
  type Paginated,
} from "@/lib/pagination";

export type PolicyListItem = {
  id: string;
  policyNumber: string;
  status: PolicyStatus;
  premiumNet: number | null;
  currency: string;
  startDate: Date | null;
  endDate: Date | null;
  companyId: string | null;
  lineId: string | null;
  assignedUserId: string | null;
  createdAt: Date;
  client: { id: string; name: string };
  daysToExpiry: number | null;
  renewalLevel: RenewalLevel;
};

/** Pólizas paginadas (cursor) acotadas por rol, con estado de renovación. */
export async function listPolicies(
  ctx: SessionContext,
  db: Db,
  page: PageParams,
): Promise<Paginated<PolicyListItem>> {
  const where = canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId };
  const [rows, total] = await Promise.all([
    db.policy.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorArgs(page),
      select: {
        id: true,
        policyNumber: true,
        status: true,
        premiumNet: true,
        currency: true,
        startDate: true,
        endDate: true,
        companyId: true,
        lineId: true,
        assignedUserId: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
    }),
    db.policy.count({ where }),
  ]);

  const enriched: PolicyListItem[] = rows.map((p) => {
    const renewal = renewalInfo(p.status, p.endDate);
    return {
      ...p,
      premiumNet: p.premiumNet ? Number(p.premiumNet) : null,
      daysToExpiry: renewal.daysToExpiry,
      renewalLevel: renewal.level,
    };
  });
  return buildPaginated(enriched, page, total);
}

/**
 * Pólizas que requieren atención de renovación. Tira solo las VIGENTES con
 * endDate cercana al filtro de needsRenewal y ordena por urgencia. Pagina por
 * cursor sobre endDate+id.
 */
export async function listRenewals(
  ctx: SessionContext,
  db: Db,
  page: PageParams,
): Promise<Paginated<PolicyListItem>> {
  const where = {
    ...(canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId }),
    status: "VIGENTE" as const,
    endDate: { not: null },
  };
  const [rows, total] = await Promise.all([
    db.policy.findMany({
      where,
      orderBy: [{ endDate: "asc" }, { id: "asc" }],
      ...cursorArgs(page),
      select: {
        id: true,
        policyNumber: true,
        status: true,
        premiumNet: true,
        currency: true,
        startDate: true,
        endDate: true,
        companyId: true,
        lineId: true,
        assignedUserId: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
    }),
    db.policy.count({ where }),
  ]);

  const enriched: PolicyListItem[] = rows
    .map((p) => {
      const renewal = renewalInfo(p.status, p.endDate);
      return {
        ...p,
        premiumNet: p.premiumNet ? Number(p.premiumNet) : null,
        daysToExpiry: renewal.daysToExpiry,
        renewalLevel: renewal.level,
      };
    })
    .filter((p) => needsRenewal(p.renewalLevel));
  return buildPaginated(enriched, page, total);
}

/**
 * Lista TODAS las pólizas (hasta 1000) — para dashboard y reportes que
 * agregan/agrupan. Para listado de UI usar `listPolicies` con cursor.
 */
export async function listAllPoliciesForDashboard(
  ctx: SessionContext,
  db: Db,
): Promise<PolicyListItem[]> {
  const where = canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId };
  const rows = await db.policy.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1000,
    select: {
      id: true,
      policyNumber: true,
      status: true,
      premiumNet: true,
      currency: true,
      startDate: true,
      endDate: true,
      companyId: true,
      lineId: true,
      assignedUserId: true,
      createdAt: true,
      client: { select: { id: true, name: true } },
    },
  });
  return rows.map((p) => {
    const renewal = renewalInfo(p.status, p.endDate);
    return {
      ...p,
      premiumNet: p.premiumNet ? Number(p.premiumNet) : null,
      daysToExpiry: renewal.daysToExpiry,
      renewalLevel: renewal.level,
    };
  });
}

/** Renovaciones para el dashboard — derivadas de listAllPoliciesForDashboard. */
export async function listAllRenewalsForDashboard(
  ctx: SessionContext,
  db: Db,
): Promise<PolicyListItem[]> {
  const all = await listAllPoliciesForDashboard(ctx, db);
  return all
    .filter((p) => needsRenewal(p.renewalLevel))
    .sort((a, b) => (a.daysToExpiry ?? 9999) - (b.daysToExpiry ?? 9999));
}

/** Detalle de una póliza con materia asegurada, coberturas e historial. */
export async function getPolicyDetail(db: Db, id: string) {
  const policy = await db.policy.findFirst({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          rut: true,
          comentarioAlerta: true,
        },
      },
      items: { orderBy: { createdAt: "asc" } },
      coverages: { orderBy: { createdAt: "asc" } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!policy) return null;
  return {
    ...policy,
    premiumNet: policy.premiumNet ? Number(policy.premiumNet) : null,
    items: policy.items.map((item) => ({
      ...item,
      insuredAmount: item.insuredAmount ? Number(item.insuredAmount) : null,
    })),
    coverages: policy.coverages.map((coverage) => ({
      ...coverage,
      insuredAmount: coverage.insuredAmount
        ? Number(coverage.insuredAmount)
        : null,
    })),
  };
}

export type PolicyDetail = NonNullable<
  Awaited<ReturnType<typeof getPolicyDetail>>
>;

/** Pólizas de un cliente, para la ficha 360°. */
export async function listClientPolicies(db: Db, clientId: string) {
  return db.policy.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      policyNumber: true,
      status: true,
      endDate: true,
    },
  });
}

/** Bitácora de actividad de una póliza. */
export async function getPolicyActivity(db: Db, policyId: string) {
  return db.activityLog.findMany({
    where: { entityType: "POLICY", entityId: policyId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
