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

export type AgingRow = {
  policyNumber: string;
  clientName: string;
  currency: string;
  amount: number;
  dueDate: Date;
  daysLate: number;
  bucket: AgingBucket;
};

export type ReportsSnapshot = {
  portfolioCount: number;
  premiumByCurrency: { currency: string; amount: number }[];
  retention: RetentionCounts;
  retentionRate: number | null;
  aging: Record<AgingBucket, { count: number; amount: number }>;
  agingRows: AgingRow[];
  claimsByStatus: { status: string; count: number }[];
  claimsOpen: number;
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

  const [portfolio, monthPolicies, overdue, claims] = await Promise.all([
    db.policy.findMany({
      where: { ...scope, status: "VIGENTE" },
      select: { premiumNet: true, currency: true },
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
        status: "PENDIENTE",
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

  return {
    portfolioCount: portfolio.length,
    premiumByCurrency: [...premium.entries()].map(([currency, amount]) => ({
      currency,
      amount,
    })),
    retention,
    retentionRate: retentionRate(retention),
    aging,
    agingRows,
    claimsByStatus,
    claimsOpen,
  };
}
