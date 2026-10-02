import { describe, expect, it } from "vitest";
import {
  commissionReversal,
  daysFactorPremium,
  endorsementPremium,
  fullRefund,
  refundProrata,
} from "@/lib/domain/endorsement-calc";
import { calendarDaysBetween } from "@/lib/domain/term";

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("cálculo del endoso", () => {
  it("devuelve la prorrata del movimiento", () => {
    const end = day("2026-12-11");
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 344);
    const effective = new Date(end);
    effective.setUTCDate(effective.getUTCDate() - 324);
    expect(calendarDaysBetween(start, end)).toBe(344);
    expect(refundProrata(32.99, start, end, effective)).toBe(-31.072);
    const yearStart = day("2026-01-01");
    const yearEnd = day("2027-01-01");
    const with225Left = new Date(yearEnd);
    with225Left.setUTCDate(with225Left.getUTCDate() - 225);
    expect(refundProrata(29.782, yearStart, yearEnd, with225Left)).toBe(-18.3588);
  });

  it("prorratea altas y prórrogas con base 365", () => {
    const fromItem = day("2026-01-01");
    const toItem = new Date(fromItem);
    toItem.setUTCDate(toItem.getUTCDate() + 307);
    expect(daysFactorPremium(2.687, fromItem, toItem)).toBe(2.26);
    const from = day("2026-01-01");
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 117);
    expect(daysFactorPremium(234.82, from, to)).toBe(75.2711);
  });

  it("anula el 100 % y la pérdida total no devuelve prima", () => {
    expect(fullRefund(12.08)).toBe(-12.08);
    expect(
      endorsementPremium({
        method: "NONE",
        premium: { affected: 10, exempt: 2 },
        periodStart: day("2026-01-01"),
        periodEnd: day("2027-01-01"),
        effective: day("2026-06-01"),
        extensionEnd: null,
      }),
    ).toEqual({ affected: 0, exempt: 0 });
  });

  it("reversa la comisión según la regla de la compañía", () => {
    expect(
      commissionReversal({ rule: "PRORATA", originalCommission: 5.25, unearnedFactor: 28.096 / 35 }),
    ).toBe(-4.2144);
    expect(
      commissionReversal({ rule: "FULL", originalCommission: 5.25, unearnedFactor: 0.5 }),
    ).toBe(-5.25);
    expect(
      commissionReversal({ rule: "NONE", originalCommission: 5.25, unearnedFactor: 1 }),
    ).toBe(0);
  });
});
