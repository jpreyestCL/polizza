/**
 * Prima del endoso según el método del tipo. Es una estimación: si la
 * compañía trae montos, esos mandan. Base D365, salvo que el período del
 * movimiento tenga su propia duración (devolución).
 */

import { roundHalfUp } from "@/lib/domain/money";
import { calendarDaysBetween, wholeCalendarYears } from "@/lib/domain/term";
import type { CalcMethod } from "@/lib/domain/endorsement-catalog";

export type PremiumSplit = { affected: number; exempt: number };

/** factor(a, b) con base 365, o N si son N años calendario justos. */
export function periodFactor(from: Date, to: Date): number {
  const years = wholeCalendarYears(from, to);
  if (years != null) return years;
  const days = calendarDaysBetween(from, to);
  if (days <= 0) return 0;
  return days / 365;
}

/**
 * Devolución sobre el movimiento del período. El denominador es la
 * duración de ese movimiento, no 365 fijo.
 */
export function refundProrata(
  premium: number,
  periodStart: Date,
  periodEnd: Date,
  effective: Date,
): number {
  const base = calendarDaysBetween(periodStart, periodEnd);
  if (base <= 0 || premium === 0) return 0;
  const start = calendarDaysBetween(periodStart, effective) > 0 ? effective : periodStart;
  const remaining = calendarDaysBetween(start, periodEnd);
  if (remaining <= 0) return 0;
  const factor = Math.min(1, remaining / base);
  return -roundHalfUp(premium * factor, 4);
}

export function daysFactorPremium(annual: number, from: Date, to: Date): number {
  return roundHalfUp(annual * periodFactor(from, to), 4);
}

export function fullRefund(premium: number): number {
  return -roundHalfUp(premium, 4);
}

export type ReversalRule = "PRORATA" | "FULL" | "NONE";

/** Comisión esperada de un movimiento negativo. El defecto es prorrata. */
export function commissionReversal(input: {
  rule: ReversalRule;
  originalCommission: number;
  unearnedFactor: number;
}): number {
  if (input.rule === "NONE" || input.originalCommission === 0) return 0;
  if (input.rule === "FULL") return -roundHalfUp(input.originalCommission, 4);
  const factor = Math.min(1, Math.max(0, input.unearnedFactor));
  return -roundHalfUp(input.originalCommission * factor, 4);
}

export function endorsementPremium(input: {
  method: CalcMethod;
  premium: PremiumSplit;
  periodStart: Date | null;
  periodEnd: Date | null;
  effective: Date;
  extensionEnd: Date | null;
}): PremiumSplit | null {
  if (input.method === "MANUAL") return null;
  if (input.method === "NONE") return { affected: 0, exempt: 0 };
  if (input.method === "FULL_REFUND") {
    return {
      affected: fullRefund(input.premium.affected),
      exempt: fullRefund(input.premium.exempt),
    };
  }
  if (input.method === "REFUND_PRORATA") {
    if (!input.periodStart || !input.periodEnd) return null;
    return {
      affected: refundProrata(
        input.premium.affected,
        input.periodStart,
        input.periodEnd,
        input.effective,
      ),
      exempt: refundProrata(
        input.premium.exempt,
        input.periodStart,
        input.periodEnd,
        input.effective,
      ),
    };
  }
  const from =
    input.method === "DAYS_FACTOR" ? input.periodEnd : input.effective;
  const to = input.method === "DAYS_FACTOR" ? input.extensionEnd : input.periodEnd;
  if (!from || !to) return null;
  return {
    affected: daysFactorPremium(input.premium.affected, from, to),
    exempt: daysFactorPremium(input.premium.exempt, from, to),
  };
}
