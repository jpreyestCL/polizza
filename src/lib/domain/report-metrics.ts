import { agingBucket, AGING_BUCKETS, type AgingBucket } from "@/lib/domain/aging";

export type ReportPeriod = { start: Date; end: Date; label: string };

function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function parseDay(value: string | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const date = utcDay(Number(match[1]), Number(match[2]), Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Período del informe. "mes" es AAAA-MM; "desde"/"hasta" son días
 * inclusivos. Sin filtro, el mes en curso. El fin es exclusivo.
 */
export function reportPeriod(
  params: { mes?: string; desde?: string; hasta?: string },
  now: Date = new Date(),
): ReportPeriod {
  const from = parseDay(params.desde);
  const to = parseDay(params.hasta);
  if (from && to && from <= to) {
    const end = new Date(to.getTime() + 24 * 60 * 60 * 1000);
    return {
      start: from,
      end,
      label: `${params.desde} a ${params.hasta}`,
    };
  }
  const month = /^(\d{4})-(\d{2})$/.exec(params.mes ?? "");
  const year = month ? Number(month[1]) : now.getUTCFullYear();
  const monthIndex = month ? Number(month[2]) : now.getUTCMonth() + 1;
  const start = utcDay(year, monthIndex, 1);
  const end = utcDay(year, monthIndex + 1, 1);
  return {
    start,
    end,
    label: `${year}-${String(monthIndex).padStart(2, "0")}`,
  };
}

export type CommissionAging = Record<
  AgingBucket,
  { count: number; byCurrency: { currency: string; amount: number }[] }
>;

/** Comisión pendiente por antigüedad desde que se generó el receivable. */
export function commissionAging(
  rows: { amount: number; currency: string; createdAt: Date }[],
  today: Date,
): CommissionAging {
  const totals = new Map<AgingBucket, { count: number; money: Map<string, number> }>();
  for (const bucket of AGING_BUCKETS) totals.set(bucket, { count: 0, money: new Map() });
  for (const row of rows) {
    const days = Math.max(
      0,
      Math.floor((today.getTime() - row.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const slot = totals.get(agingBucket(days))!;
    slot.count += 1;
    slot.money.set(row.currency, (slot.money.get(row.currency) ?? 0) + row.amount);
  }
  const out = {} as CommissionAging;
  for (const bucket of AGING_BUCKETS) {
    const slot = totals.get(bucket)!;
    out[bucket] = {
      count: slot.count,
      byCurrency: [...slot.money.entries()].map(([currency, amount]) => ({
        currency,
        amount,
      })),
    };
  }
  return out;
}

export type ClosedOnTime = {
  closed: number;
  withDeadline: number;
  onTime: number;
  rate: number | null;
};

/**
 * Siniestros cerrados en el período: a tiempo si el cierre cae el día del
 * plazo o antes. Sin plazo no entran en la tasa.
 */
export function closedOnTime(
  claims: { closedAt: Date | null; closeDeadline: Date | null }[],
): ClosedOnTime {
  let withDeadline = 0;
  let onTime = 0;
  for (const claim of claims) {
    if (!claim.closedAt || !claim.closeDeadline) continue;
    withDeadline += 1;
    const closedDay = Date.UTC(
      claim.closedAt.getUTCFullYear(),
      claim.closedAt.getUTCMonth(),
      claim.closedAt.getUTCDate(),
    );
    if (closedDay <= claim.closeDeadline.getTime()) onTime += 1;
  }
  return {
    closed: claims.filter((claim) => claim.closedAt).length,
    withDeadline,
    onTime,
    rate: withDeadline > 0 ? onTime / withDeadline : null,
  };
}

export type QuoteSuccess = { won: number; lost: number; rate: number | null };

/** Ganadas sobre decididas (ganadas más perdidas). */
export function quoteSuccess(
  byStatus: { status: string; count: number }[],
): QuoteSuccess {
  const won = byStatus.find((row) => row.status === "GANADA")?.count ?? 0;
  const lost = byStatus.find((row) => row.status === "PERDIDA")?.count ?? 0;
  return { won, lost, rate: won + lost > 0 ? won / (won + lost) : null };
}
