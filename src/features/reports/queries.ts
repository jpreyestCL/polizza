import "server-only";
import type { SessionContext } from "@/server/context";
import type { Db } from "@/server/db";
import { canSeeAllClients } from "@/lib/roles";
import { calendarDaysBetween } from "@/lib/domain/term";
import { agingBucket, type AgingBucket } from "@/lib/domain/aging";
import {
  addRetentionCount,
  emptyRetentionCounts,
  retentionRate,
  type RetentionCounts,
} from "@/lib/domain/renewal-status";
import { renewalStatusByPolicy } from "@/features/policies/renewal-context";
import { backfillMissingIssueMovements } from "@/features/ledger/record";
import { earnedNetAt, lossRatio } from "@/lib/domain/loss-ratio";
import {
  buildReportCatalog,
  type ReportCard,
} from "@/lib/domain/report-catalog";

export type AgingRow = {
  policyNumber: string;
  clientName: string;
  currency: string;
  amount: number;
  dueDate: Date;
  daysLate: number;
  bucket: AgingBucket;
};

export type ProductionRow = {
  currency: string;
  movementType: string;
  count: number;
  net: number;
  gross: number;
  commission: number;
};

export type ReportsSnapshot = {
  portfolioCount: number;
  premiumByCurrency: { currency: string; amount: number }[];
  production: ProductionRow[];
  retention: RetentionCounts;
  retentionRate: number | null;
  aging: Record<AgingBucket, { count: number; amount: number }>;
  agingRows: AgingRow[];
  claimsByStatus: { status: string; count: number }[];
  claimsOpen: number;
  catalog: ReportCard[];
};

function monthBounds(now: Date): { start: Date; end: Date; today: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return { start, end, today };
}

function emptyAging(): Record<AgingBucket, { count: number; amount: number }> {
  return {
    "1-30": { count: 0, amount: 0 },
    "31-60": { count: 0, amount: 0 },
    "61-90": { count: 0, amount: 0 },
    "90+": { count: 0, amount: 0 },
  };
}

/** Informes de cartera, renovación del mes, mora y siniestros. */
export async function getReportsSnapshot(
  ctx: SessionContext,
  db: Db,
  now: Date = new Date(),
): Promise<ReportsSnapshot> {
  const scope = canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId };
  const { start, end, today } = monthBounds(now);
  await backfillMissingIssueMovements(db);

  const taskScope = canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId };
  const [portfolio, monthPolicies, overdue, claims, movements, paymentsInPeriod, expectedRows, pendingRows, allocationRows, issuedInPeriod, issuedWithProblems, tasksCreated, tasksCompleted, tasksOverdue, quotations, claimAmounts] =
    await Promise.all([
    db.policy.findMany({
      where: { ...scope, status: "VIGENTE" },
      select: { premiumNet: true, currency: true, startDate: true, endDate: true },
    }),
    db.policy.findMany({
      where: {
        ...scope,
        status: { in: ["VIGENTE", "VENCIDA", "RENOVADA"] },
        endDate: { gte: start, lt: end },
      },
      select: {
        id: true,
        status: true,
        endDate: true,
        notRenewable: true,
        nonRenewalAt: true,
        productId: true,
      },
    }),
    db.installment.findMany({
      where: {
        status: { in: ["PENDIENTE", "PARCIAL", "RECHAZADA"] },
        dueDate: { lt: today },
        policy: { ...scope },
      },
      select: {
        amount: true,
        currency: true,
        dueDate: true,
        policy: {
          select: {
            policyNumber: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 200,
    }),
    db.claim.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.premiumMovement.findMany({
      where: {
        issuedOn: { gte: start, lt: end },
        policy: scope,
      },
      select: {
        movementType: true,
        currency: true,
        premiumNet: true,
        premiumGross: true,
        commissionTotal: true,
      },
    }),
    db.installment.count({
      where: {
        status: "PAGADA",
        paidAt: { gte: start, lt: end },
        policy: scope,
      },
    }),
    db.commissionReceivable.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        status: { not: "VOID" },
        policy: scope,
      },
      select: { amount: true, currency: true },
    }),
    db.commissionReceivable.findMany({
      where: { status: "PENDING", policy: scope },
      select: { amount: true, currency: true },
    }),
    db.commissionAllocation.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        receivable: { policy: scope },
      },
      select: { amount: true },
    }),
    db.policy.count({
      where: { ...scope, createdAt: { gte: start, lt: end } },
    }),
    db.policy.count({
      where: {
        ...scope,
        createdAt: { gte: start, lt: end },
        issueProblemCode: { not: null },
      },
    }),
    db.task.count({
      where: { ...taskScope, createdAt: { gte: start, lt: end } },
    }),
    db.task.count({
      where: {
        ...taskScope,
        status: "COMPLETADA",
        updatedAt: { gte: start, lt: end },
      },
    }),
    db.task.count({
      where: {
        ...taskScope,
        status: { in: ["PENDIENTE", "EN_PROGRESO"] },
        dueDate: { lt: today },
      },
    }),
    db.carQuotation.groupBy({
      by: ["status"],
      where: taskScope,
      _count: { _all: true },
    }),
    db.claim.findMany({
      where: taskScope,
      select: {
        status: true,
        currency: true,
        settledAmount: true,
        estimatedAmount: true,
      },
    }),
  ]);

  const premium = new Map<string, number>();
  for (const policy of portfolio) {
    const currency = policy.currency || "UF";
    premium.set(
      currency,
      (premium.get(currency) ?? 0) + Number(policy.premiumNet ?? 0),
    );
  }

  const productIds = [
    ...new Set(
      monthPolicies
        .map((policy) => policy.productId)
        .filter((id): id is string => !!id),
    ),
  ];
  const products =
    productIds.length === 0
      ? []
      : await db.insuranceProduct.findMany({
          where: { id: { in: productIds } },
          select: { id: true, isRenewable: true },
        });
  const renewableByProduct = new Map(
    products.map((product) => [product.id, product.isRenewable]),
  );
  const statuses = await renewalStatusByPolicy(
    db,
    monthPolicies.map((policy) => ({
      id: policy.id,
      status: policy.status,
      endDate: policy.endDate,
      notRenewable: policy.notRenewable,
      nonRenewalAt: policy.nonRenewalAt,
      productRenewable: policy.productId
        ? (renewableByProduct.get(policy.productId) ?? null)
        : null,
    })),
    now,
  );
  const retention = emptyRetentionCounts();
  for (const policy of monthPolicies) {
    addRetentionCount(retention, statuses.get(policy.id) ?? "NOT_DUE");
  }

  const aging = emptyAging();
  const agingRows: AgingRow[] = [];
  for (const row of overdue) {
    if (!row.policy) continue;
    const daysLate = calendarDaysBetween(row.dueDate, today);
    if (daysLate <= 0) continue;
    const bucket = agingBucket(daysLate);
    const amount = Number(row.amount);
    aging[bucket].count += 1;
    aging[bucket].amount += amount;
    agingRows.push({
      policyNumber: row.policy.policyNumber,
      clientName: row.policy.client.name,
      currency: row.currency,
      amount,
      dueDate: row.dueDate,
      daysLate,
      bucket,
    });
  }

  const claimsByStatus = claims
    .map((row) => ({ status: row.status, count: row._count._all }))
    .sort((a, b) => b.count - a.count);
  const claimsOpen = claimsByStatus
    .filter((row) => row.status !== "CERRADO")
    .reduce((sum, row) => sum + row.count, 0);

  const productionMap = new Map<string, ProductionRow>();
  for (const movement of movements) {
    const key = `${movement.currency}|${movement.movementType}`;
    const current = productionMap.get(key) ?? {
      currency: movement.currency,
      movementType: movement.movementType,
      count: 0,
      net: 0,
      gross: 0,
      commission: 0,
    };
    current.count += 1;
    current.net += Number(movement.premiumNet);
    current.gross += Number(movement.premiumGross);
    current.commission += Number(movement.commissionTotal);
    productionMap.set(key, current);
  }

  const productionRows = [...productionMap.values()];
  const premiumByCurrency = [...premium.entries()].map(([currency, amount]) => ({
    currency,
    amount,
  }));
  const productionByCurrency = new Map<
    string,
    { currency: string; net: number; gross: number; commission: number }
  >();
  for (const row of productionRows) {
    const current = productionByCurrency.get(row.currency) ?? {
      currency: row.currency,
      net: 0,
      gross: 0,
      commission: 0,
    };
    current.net += row.net;
    current.gross += row.gross;
    current.commission += row.commission;
    productionByCurrency.set(row.currency, current);
  }

  const sumByCurrency = (
    rows: { currency: string; amount: { toString(): string } | number }[],
  ) => {
    const totals = new Map<string, number>();
    for (const row of rows) {
      totals.set(row.currency, (totals.get(row.currency) ?? 0) + Number(row.amount));
    }
    return [...totals.entries()].map(([currency, amount]) => ({ currency, amount }));
  };

  const earnedByCurrency = new Map<string, number>();
  for (const policy of portfolio) {
    if (!policy.startDate || !policy.endDate || policy.premiumNet == null) continue;
    const currency = policy.currency || "UF";
    const earned = earnedNetAt(
      Number(policy.premiumNet),
      policy.startDate,
      policy.endDate,
      today,
    );
    earnedByCurrency.set(currency, (earnedByCurrency.get(currency) ?? 0) + earned);
  }
  const paidByCurrency = new Map<string, number>();
  const openByCurrency = new Map<string, number>();
  const openClaimStatuses = new Set([
    "REPORTADO",
    "INGRESADO_COMPANIA",
    "EN_EVALUACION",
    "APROBADO",
  ]);
  for (const claim of claimAmounts) {
    const currency = claim.currency || "UF";
    if (claim.status === "PAGADO") {
      paidByCurrency.set(
        currency,
        (paidByCurrency.get(currency) ?? 0) + Number(claim.settledAmount ?? 0),
      );
    } else if (openClaimStatuses.has(claim.status)) {
      openByCurrency.set(
        currency,
        (openByCurrency.get(currency) ?? 0) + Number(claim.estimatedAmount ?? 0),
      );
    }
  }
  const lossCurrencies = new Set([
    ...earnedByCurrency.keys(),
    ...paidByCurrency.keys(),
    ...openByCurrency.keys(),
  ]);
  const lossByCurrency = [...lossCurrencies].map((currency) => {
    const earned = earnedByCurrency.get(currency) ?? 0;
    const paid = paidByCurrency.get(currency) ?? 0;
    const open = openByCurrency.get(currency) ?? 0;
    return {
      currency,
      earned,
      indemnity: paid + open,
      ratio: lossRatio(paid, open, earned),
    };
  });

  const catalog = buildReportCatalog({
    production: [...productionByCurrency.values()],
    portfolioCount: portfolio.length,
    premiumByCurrency,
    retentionRate: retentionRate(retention),
    retentionUniverse: retention.universe,
    agingCount: agingRows.length,
    paymentsInPeriod,
    expectedCommission: sumByCurrency(expectedRows),
    allocatedCommission: allocationRows.reduce(
      (sum, row) => sum + Number(row.amount),
      0,
    ),
    pendingCommission: sumByCurrency(pendingRows),
    claimsOpen,
    issuedInPeriod,
    issuedWithProblems,
    tasksCreated,
    tasksCompleted,
    tasksOverdue,
    quotationsByStatus: quotations.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    lossByCurrency,
  });

  return {
    portfolioCount: portfolio.length,
    premiumByCurrency,
    production: productionRows,
    retention,
    retentionRate: retentionRate(retention),
    aging,
    agingRows,
    claimsByStatus,
    claimsOpen,
    catalog,
  };
}
