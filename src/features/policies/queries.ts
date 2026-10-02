import "server-only";
import type { PolicyStatus } from "@prisma/client";
import type { SessionContext } from "@/server/context";
import { computeGross } from "./premium";
import type { Db } from "@/server/db";
import { canSeeAllClients } from "@/lib/roles";
import { renewalInfo, type RenewalLevel } from "@/lib/renewal";
import {
  ACTIONABLE_RENEWAL_STATUSES,
  type RenewalStatus,
} from "@/lib/domain/renewal-status";
import { renewalStatusByPolicy } from "./renewal-context";
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
  renewalStatus: RenewalStatus;
  quoting: boolean;
  renewalRisk: "AT_RISK" | "OVERDUE" | null;
};

type PolicyListRow = {
  id: string;
  policyNumber: string;
  status: PolicyStatus;
  premiumNet: { toString(): string } | null;
  currency: string;
  startDate: Date | null;
  endDate: Date | null;
  companyId: string | null;
  lineId: string | null;
  assignedUserId: string | null;
  createdAt: Date;
  notRenewable: boolean;
  nonRenewalAt: Date | null;
  productId: string | null;
  client: { id: string; name: string };
};

async function toPolicyListItems(
  db: Db,
  rows: PolicyListRow[],
): Promise<PolicyListItem[]> {
  const productIds = [
    ...new Set(rows.map((row) => row.productId).filter((id): id is string => !!id)),
  ];
  const products =
    productIds.length === 0
      ? []
      : await db.insuranceProduct.findMany({
          where: { id: { in: productIds } },
          select: { id: true, isRenewable: true },
        });
  const renewableByProduct = new Map(products.map((product) => [product.id, product.isRenewable]));
  const statuses = await renewalStatusByPolicy(
    db,
    rows.map((row) => ({
      id: row.id,
      status: row.status,
      endDate: row.endDate,
      notRenewable: row.notRenewable,
      nonRenewalAt: row.nonRenewalAt,
      productRenewable: row.productId
        ? (renewableByProduct.get(row.productId) ?? null)
        : null,
    })),
  );
  return rows.map((row) => {
    const renewal = renewalInfo(row.status, row.endDate);
    return {
      id: row.id,
      policyNumber: row.policyNumber,
      status: row.status,
      premiumNet: row.premiumNet ? Number(row.premiumNet) : null,
      currency: row.currency,
      startDate: row.startDate,
      endDate: row.endDate,
      companyId: row.companyId,
      lineId: row.lineId,
      assignedUserId: row.assignedUserId,
      createdAt: row.createdAt,
      client: row.client,
      daysToExpiry: renewal.daysToExpiry,
      renewalLevel: renewal.level,
      renewalStatus: statuses.get(row.id)?.status ?? "NOT_DUE",
      quoting: statuses.get(row.id)?.quoting ?? false,
      renewalRisk: statuses.get(row.id)?.risk ?? null,
    };
  });
}

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
        notRenewable: true,
        nonRenewalAt: true,
        productId: true,
        client: { select: { id: true, name: true } },
      },
    }),
    db.policy.count({ where }),
  ]);

  return buildPaginated(await toPolicyListItems(db, rows), page, total);
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
  q?: string,
): Promise<Paginated<PolicyListItem>> {
  const term = q?.trim();
  const soap = await db.insuranceLine.findMany({
    where: {
      OR: [
        { code: { equals: "soap", mode: "insensitive" } },
        { name: { contains: "soap", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  const where = {
    ...(canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId }),
    status: { in: ["VIGENTE", "VENCIDA"] as PolicyStatus[] },
    notRenewable: false,
    nonRenewalAt: null,
    endDate: { not: null },
    ...(soap.length > 0 ? { NOT: { lineId: { in: soap.map((line) => line.id) } } } : {}),
    ...(term
      ? {
          OR: [
            { policyNumber: { contains: term, mode: "insensitive" as const } },
            { client: { name: { contains: term, mode: "insensitive" as const } } },
          ],
        }
      : {}),
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
        notRenewable: true,
        nonRenewalAt: true,
        productId: true,
        client: { select: { id: true, name: true } },
      },
    }),
    db.policy.count({ where }),
  ]);

  const enriched = (await toPolicyListItems(db, rows)).filter((p) =>
    ACTIONABLE_RENEWAL_STATUSES.includes(p.renewalStatus),
  );
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
      notRenewable: true,
      nonRenewalAt: true,
      productId: true,
      client: { select: { id: true, name: true } },
    },
  });
  return toPolicyListItems(db, rows);
}

/** Renovaciones para el dashboard — derivadas de listAllPoliciesForDashboard. */
export async function listAllRenewalsForDashboard(
  ctx: SessionContext,
  db: Db,
): Promise<PolicyListItem[]> {
  const all = await listAllPoliciesForDashboard(ctx, db);
  return all
    .filter(
      (p) =>
        (p.status === "VIGENTE" || p.status === "VENCIDA") &&
        ACTIONABLE_RENEWAL_STATUSES.includes(p.renewalStatus),
    )
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
      premiumMovements: { orderBy: { seqNo: "asc" } },
      proposal: {
        select: {
          productId: true,
          branchType: { select: { name: true } },
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
  const asNumber = (value: { toString(): string } | null | undefined) =>
    value == null ? null : Number(value);
  const premiumNet = policy.premiumNet ? Number(policy.premiumNet) : null;
  return {
    ...policy,
    premiumNet,
    premiumAffect: asNumber(policy.premiumAffect),
    premiumExempt: asNumber(policy.premiumExempt),
    commissionPercent: asNumber(policy.commissionPercent),
    commissionAmount: asNumber(policy.commissionAmount),
    commissionCalculated: asNumber(policy.commissionCalculated),
    commissionAffect: asNumber(policy.commissionAffect),
    commissionExempt: asNumber(policy.commissionExempt),
    commissionAffectPct: asNumber(policy.commissionAffectPct),
    commissionExemptPct: asNumber(policy.commissionExemptPct),
    commissionFinalCompany: asNumber(policy.commissionFinalCompany),
    exchangeRate: asNumber(policy.exchangeRate),
    ufValue: asNumber(policy.ufValue),
    salesCommissionPct: asNumber(policy.salesCommissionPct),
    terminationBalance: asNumber(policy.terminationBalance),
    premiumGross: computeGross(premiumNet, policy.proposal, policy),
    proposal: policy.proposal
      ? {
          ...policy.proposal,
          items: policy.proposal.items.map((item) => ({
            coverages: item.coverages.map((coverage) => ({
              premiumAffect: asNumber(coverage.premiumAffect),
              premiumExempt: asNumber(coverage.premiumExempt),
            })),
          })),
        }
      : null,
    items: policy.items.map((item) => ({
      ...item,
      insuredAmount: item.insuredAmount ? Number(item.insuredAmount) : null,
    })),
    coverages: policy.coverages.map((coverage) => ({
      ...coverage,
      insuredAmount: coverage.insuredAmount
        ? Number(coverage.insuredAmount)
        : null,
      deductibleAmount: asNumber(coverage.deductibleAmount),
      deductiblePct: asNumber(coverage.deductiblePct),
      deductibleMinimum: asNumber(coverage.deductibleMinimum),
    })),
    premiumMovements: policy.premiumMovements.map((movement) => ({
      ...movement,
      premiumAffected: Number(movement.premiumAffected),
      premiumExempt: Number(movement.premiumExempt),
      taxAmount: Number(movement.taxAmount),
      premiumNet: Number(movement.premiumNet),
      premiumGross: Number(movement.premiumGross),
      commissionAffected: Number(movement.commissionAffected),
      commissionExempt: Number(movement.commissionExempt),
      commissionTotal: Number(movement.commissionTotal),
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
          premiumAffect: true,
          premiumExempt: true,
          productId: true,
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
    // 1) producto propio de la póliza (importadas y emitidas ya asignadas),
    // 2) el de la propuesta de origen, 3) derivado por ramo+compañía.
    const product =
      (p.productId ? productById.get(p.productId) : null) ??
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
      premiumGross: computeGross(net, p.proposal, p),
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
