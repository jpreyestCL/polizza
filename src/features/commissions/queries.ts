import "server-only";
import type { PolicyStatus } from "@prisma/client";
import type { SessionContext } from "@/server/context";
import type { Db } from "@/server/db";
import { canSeeAllClients } from "@/lib/roles";
import {
  brokerCommissionOf,
  appliedSellerPct,
  sellerPayout,
  totalCompanyPaid,
  isPaidByCompany,
} from "@/lib/commissions";

/** Tope de filas del reporte de comisiones (un solo "página" como el legacy). */
const MAX_COMMISSION_ROWS = 2000;

export type CommissionFilters = {
  q?: string;
  companyId?: string;
  lineId?: string;
  status?: PolicyStatus;
  salespersonId?: string;
  /** ISO date (YYYY-MM-DD) sobre inicio de vigencia (startDate). */
  dateFrom?: string;
  dateTo?: string;
  /** "SI" | "NO" | undefined. Filtra por estado pagado-por-compañía. */
  paidByCompany?: "SI" | "NO";
};

export type CommissionRow = {
  policyId: string;
  policyNumber: string;
  proposalNumber: string | null;
  status: PolicyStatus;
  companyId: string | null;
  lineId: string | null;
  clientId: string;
  clientName: string;
  startDate: Date | null;
  premiumNet: number | null;
  currency: string;
  /** Comisión de la corredora (monto o derivado), en moneda de la póliza. */
  brokerCommission: number;
  /** Total pagado por la compañía, convertido a la moneda de la póliza. */
  companyPaid: number;
  paidByCompany: boolean;
  salespersonId: string | null;
  /** Override de % de comisión del vendedor en esta póliza (null = default). */
  salesCommissionPct: number | null;
  /** Si la comisión del vendedor de esta póliza ya fue liquidada. */
  settled: boolean;
  /** Pagos de compañía registrados, para ver/eliminar en el diálogo. */
  payments: {
    id: string;
    paymentDate: Date;
    amount: number;
    currency: string;
    invoiceNumber: string | null;
  }[];
};

export type CommissionListResult = {
  rows: CommissionRow[];
  total: number;
  truncated: boolean;
};

/**
 * Reporte de comisiones de la corredora. Bounded (no cursor) porque es un
 * reporte que se exporta entero a Excel. Filtros SQL + derivados en JS.
 */
export async function listCommissions(
  ctx: SessionContext,
  db: Db,
  filters: CommissionFilters = {},
): Promise<CommissionListResult> {
  const q = filters.q?.trim();
  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : null;
  const dateTo = filters.dateTo ? new Date(filters.dateTo) : null;

  const where = {
    ...(canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId }),
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(filters.lineId ? { lineId: filters.lineId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.salespersonId ? { salespersonId: filters.salespersonId } : {}),
    ...(dateFrom || dateTo
      ? {
          startDate: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { policyNumber: { contains: q, mode: "insensitive" as const } },
            { client: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const rows = await db.policy.findMany({
    where,
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
    take: MAX_COMMISSION_ROWS + 1,
    select: {
      id: true,
      policyNumber: true,
      status: true,
      companyId: true,
      lineId: true,
      clientId: true,
      startDate: true,
      premiumNet: true,
      currency: true,
      commissionPercent: true,
      commissionAmount: true,
      salespersonId: true,
      salesCommissionPct: true,
      client: { select: { name: true } },
      proposal: { select: { proposalNumber: true } },
      companyCommissionPayments: {
        orderBy: { paymentDate: "desc" },
        select: {
          id: true,
          paymentDate: true,
          amount: true,
          currency: true,
          exchangeFactor: true,
          invoiceNumber: true,
        },
      },
      sellerCommissionItem: { select: { id: true } },
    },
  });

  const truncated = rows.length > MAX_COMMISSION_ROWS;
  const sliced = truncated ? rows.slice(0, MAX_COMMISSION_ROWS) : rows;

  let mapped: CommissionRow[] = sliced.map((p) => {
    const brokerCommission = brokerCommissionOf({
      commissionAmount:
        p.commissionAmount != null ? Number(p.commissionAmount) : null,
      premiumNet: p.premiumNet != null ? Number(p.premiumNet) : null,
      commissionPercent:
        p.commissionPercent != null ? Number(p.commissionPercent) : null,
    });
    const payments = p.companyCommissionPayments.map((cp) => ({
      amount: Number(cp.amount),
      currency: cp.currency,
      exchangeFactor:
        cp.exchangeFactor != null ? Number(cp.exchangeFactor) : null,
    }));
    const companyPaid = totalCompanyPaid(payments, p.currency);
    return {
      policyId: p.id,
      policyNumber: p.policyNumber,
      proposalNumber: p.proposal?.proposalNumber ?? null,
      status: p.status,
      companyId: p.companyId,
      lineId: p.lineId,
      clientId: p.clientId,
      clientName: p.client.name,
      startDate: p.startDate,
      premiumNet: p.premiumNet != null ? Number(p.premiumNet) : null,
      currency: p.currency,
      brokerCommission,
      companyPaid,
      paidByCompany: isPaidByCompany(brokerCommission, companyPaid),
      salespersonId: p.salespersonId,
      salesCommissionPct:
        p.salesCommissionPct != null ? Number(p.salesCommissionPct) : null,
      settled: Boolean(p.sellerCommissionItem),
      payments: p.companyCommissionPayments.map((cp) => ({
        id: cp.id,
        paymentDate: cp.paymentDate,
        amount: Number(cp.amount),
        currency: cp.currency,
        invoiceNumber: cp.invoiceNumber,
      })),
    };
  });

  if (filters.paidByCompany === "SI") {
    mapped = mapped.filter((r) => r.paidByCompany);
  } else if (filters.paidByCompany === "NO") {
    mapped = mapped.filter((r) => !r.paidByCompany);
  }

  return { rows: mapped, total: mapped.length, truncated };
}

export type SettleablePolicy = {
  policyId: string;
  policyNumber: string;
  clientName: string;
  companyId: string | null;
  lineId: string | null;
  startDate: Date | null;
  currency: string;
  brokerCommission: number;
  appliedPct: number | null;
  payout: number;
};

/**
 * Pólizas de un vendedor elegibles para liquidar: pagadas por la compañía y
 * aún no liquidadas. Calcula el pago al vendedor con override por póliza o la
 * tasa default del vendedor.
 */
export async function listSettleablePolicies(
  ctx: SessionContext,
  db: Db,
  salespersonId: string,
): Promise<{ rows: SettleablePolicy[]; defaultPct: number | null }> {
  const rate = await db.salespersonCommissionRate.findFirst({
    where: { userId: salespersonId },
    select: { defaultPct: true, isActive: true },
  });
  const defaultPct =
    rate && rate.isActive ? Number(rate.defaultPct) : null;

  // Tope defensivo: si un vendedor superara este número de pólizas no
  // liquidadas, algunas elegibles quedarían fuera. Improbable en operación; se
  // liquidan por tandas, así que el cap se vacía a medida que se liquida.
  const policies = await db.policy.findMany({
    where: {
      salespersonId,
      sellerCommissionItem: { is: null },
    },
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
    take: MAX_COMMISSION_ROWS,
    select: {
      id: true,
      policyNumber: true,
      companyId: true,
      lineId: true,
      startDate: true,
      currency: true,
      premiumNet: true,
      commissionPercent: true,
      commissionAmount: true,
      salesCommissionPct: true,
      client: { select: { name: true } },
      companyCommissionPayments: {
        select: { amount: true, currency: true, exchangeFactor: true },
      },
    },
  });

  const rows: SettleablePolicy[] = [];
  for (const p of policies) {
    const brokerCommission = brokerCommissionOf({
      commissionAmount:
        p.commissionAmount != null ? Number(p.commissionAmount) : null,
      premiumNet: p.premiumNet != null ? Number(p.premiumNet) : null,
      commissionPercent:
        p.commissionPercent != null ? Number(p.commissionPercent) : null,
    });
    const companyPaid = totalCompanyPaid(
      p.companyCommissionPayments.map((cp) => ({
        amount: Number(cp.amount),
        currency: cp.currency,
        exchangeFactor:
          cp.exchangeFactor != null ? Number(cp.exchangeFactor) : null,
      })),
      p.currency,
    );
    if (!isPaidByCompany(brokerCommission, companyPaid)) continue;
    const pct = appliedSellerPct(
      p.salesCommissionPct != null ? Number(p.salesCommissionPct) : null,
      defaultPct,
    );
    rows.push({
      policyId: p.id,
      policyNumber: p.policyNumber,
      clientName: p.client.name,
      companyId: p.companyId,
      lineId: p.lineId,
      startDate: p.startDate,
      currency: p.currency,
      brokerCommission,
      appliedPct: pct,
      payout: sellerPayout(brokerCommission, pct),
    });
  }
  return { rows, defaultPct };
}

/** Tasas de comisión por vendedor. */
export async function listSalespersonRates(db: Db) {
  const rows = await db.salespersonCommissionRate.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true, defaultPct: true, isActive: true },
  });
  return rows.map((r) => ({ ...r, defaultPct: Number(r.defaultPct) }));
}

export type SalespersonRateRow = Awaited<
  ReturnType<typeof listSalespersonRates>
>[number];

/** Liquidaciones de vendedores, con conteo y total. */
export async function listSettlements(db: Db) {
  const rows = await db.sellerCommissionSettlement.findMany({
    orderBy: { number: "desc" },
    select: {
      id: true,
      number: true,
      salespersonId: true,
      status: true,
      currency: true,
      totalAmount: true,
      paidAt: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });
  return rows.map((r) => ({ ...r, totalAmount: Number(r.totalAmount) }));
}

export type SettlementRow = Awaited<ReturnType<typeof listSettlements>>[number];

/** Detalle de una liquidación con sus pólizas. */
export async function getSettlementDetail(db: Db, id: string) {
  const settlement = await db.sellerCommissionSettlement.findFirst({
    where: { id },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          policy: {
            select: {
              policyNumber: true,
              companyId: true,
              lineId: true,
              startDate: true,
              client: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!settlement) return null;
  return {
    ...settlement,
    totalAmount: Number(settlement.totalAmount),
    items: settlement.items.map((it) => ({
      ...it,
      baseCommissionAmount: Number(it.baseCommissionAmount),
      appliedPct: Number(it.appliedPct),
      amount: Number(it.amount),
    })),
  };
}

export type SettlementDetail = NonNullable<
  Awaited<ReturnType<typeof getSettlementDetail>>
>;
