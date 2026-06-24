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

export type PolicyListFilters = {
  /** Texto libre: busca en número de póliza y nombre del cliente (insensitive). */
  q?: string;
  status?: PolicyStatus;
  companyId?: string;
};

/** Pólizas paginadas (cursor) acotadas por rol, con estado de renovación. */
export async function listPolicies(
  ctx: SessionContext,
  db: Db,
  page: PageParams,
  filters: PolicyListFilters = {},
): Promise<Paginated<PolicyListItem>> {
  const q = filters.q?.trim();
  const where = {
    ...(canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId }),
    ...(q
      ? {
          OR: [
            { policyNumber: { contains: q, mode: "insensitive" as const } },
            { client: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
  };
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
      proposal: {
        select: {
          items: {
            select: {
              coverages: {
                select: { premiumAffect: true, premiumExempt: true },
              },
            },
          },
        },
      },
    },
  });
  if (!policy) return null;
  const premiumNet = policy.premiumNet ? Number(policy.premiumNet) : null;
  return {
    ...policy,
    premiumNet,
    premiumGross: computeGross(premiumNet, policy.proposal),
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

export type ClientPolicyRow = {
  id: string;
  policyNumber: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  currency: string;
  ramo: string | null;
  company: string | null;
  product: string | null;
  premiumNet: number | null;
  /** Prima bruta = (afecta × 1.19) + exenta. Si no hay desglose, neta × 1.19. */
  premiumGross: number | null;
};

/**
 * Calcula la prima bruta de una póliza. Si proviene de una propuesta con
 * coberturas, usa el desglose afecta/exenta: bruta = afecta×1.19 + exenta.
 * Si no (póliza importada sin desglose), asume afecta: neta × 1.19.
 */
function computeGross(
  net: number | null,
  proposal: {
    items: { coverages: { premiumAffect: unknown; premiumExempt: unknown }[] }[];
  } | null,
): number | null {
  if (proposal) {
    let affect = 0;
    let exempt = 0;
    let hasSplit = false;
    for (const it of proposal.items) {
      for (const c of it.coverages) {
        if (c.premiumAffect != null) {
          affect += Number(c.premiumAffect);
          hasSplit = true;
        }
        if (c.premiumExempt != null) {
          exempt += Number(c.premiumExempt);
          hasSplit = true;
        }
      }
    }
    if (hasSplit && affect + exempt > 0) return affect * 1.19 + exempt;
  }
  return net != null ? net * 1.19 : null;
}

/** Pólizas de un cliente, para la ficha 360°. Enriquece ramo, producto,
 * compañía, vigencia y prima bruta (calculada). */
export async function listClientPolicies(
  db: Db,
  clientId: string,
): Promise<ClientPolicyRow[]> {
  const [policies, companies, lines, branchTypes, products] = await Promise.all(
    [
      db.policy.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          policyNumber: true,
          status: true,
          startDate: true,
          endDate: true,
          currency: true,
          premiumNet: true,
          companyId: true,
          lineId: true,
          branchId: true,
          proposal: {
            select: {
              productId: true,
              items: {
                select: {
                  coverages: {
                    select: { premiumAffect: true, premiumExempt: true },
                  },
                },
              },
            },
          },
        },
      }),
      db.insuranceCompany.findMany({ select: { id: true, name: true } }),
      db.insuranceLine.findMany({ select: { id: true, name: true } }),
      db.branchType.findMany({ select: { id: true, name: true } }),
      db.insuranceProduct.findMany({
        select: {
          id: true,
          name: true,
          branchTypeId: true,
          insuranceCompanyId: true,
        },
      }),
    ],
  );

  const companyById = new Map(companies.map((c) => [c.id, c.name]));
  const lineById = new Map(lines.map((l) => [l.id, l.name]));
  const branchById = new Map(branchTypes.map((b) => [b.id, b.name]));
  const productById = new Map(products.map((p) => [p.id, p.name]));

  // Producto derivado por (ramo + compañía), solo cuando hay UNO inequívoco.
  const productByRamoCompany = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const p of products) {
    if (!p.branchTypeId) continue;
    const key = `${p.branchTypeId}|${p.insuranceCompanyId}`;
    if (productByRamoCompany.has(key)) ambiguous.add(key);
    else productByRamoCompany.set(key, p.name);
  }
  for (const key of ambiguous) productByRamoCompany.delete(key);

  return policies.map((p) => {
    const net = p.premiumNet != null ? Number(p.premiumNet) : null;
    const ramo =
      (p.lineId ? lineById.get(p.lineId) : null) ??
      (p.branchId ? branchById.get(p.branchId) : null) ??
      null;
    const product =
      (p.proposal?.productId
        ? productById.get(p.proposal.productId)
        : null) ??
      (p.branchId && p.companyId
        ? productByRamoCompany.get(`${p.branchId}|${p.companyId}`)
        : null) ??
      null;
    return {
      id: p.id,
      policyNumber: p.policyNumber,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
      currency: p.currency,
      ramo,
      company: p.companyId ? (companyById.get(p.companyId) ?? null) : null,
      product,
      premiumNet: net,
      premiumGross: computeGross(net, p.proposal),
    };
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
