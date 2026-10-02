import { describe, expect, it } from "vitest";
import {
  commissionTolerance,
  expectedCommission,
  premiumFromRate,
  premiumTotals,
  splitInstallments,
  withinCommissionTolerance,
} from "@/lib/domain/money";
import { terminationResult } from "@/lib/domain/termination";
import { calendarDaysBetween, unearnedFactor } from "@/lib/domain/term";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("ejemplo numérico de la especificación", () => {
  const incendio = premiumFromRate(25_000, 0.6);
  const sismo = premiumFromRate(25_000, 1.2);
  const rc = 2;
  const parts = { affected: incendio + rc, exempt: sismo };

  it("calcula prima por tasa, IVA y bruta", () => {
    expect(incendio).toBe(15);
    expect(sismo).toBe(30);
    const totals = premiumTotals(parts);
    expect(totals.affected).toBe(17);
    expect(totals.exempt).toBe(30);
    expect(totals.vat).toBe(3.23);
    expect(totals.gross).toBe(50.23);
  });

  it("calcula la comisión afecta y exenta por separado", () => {
    const commission = expectedCommission(parts, 16, 9);
    expect(commission.affected).toBe(2.72);
    expect(commission.exempt).toBe(2.7);
    expect(commission.total).toBe(5.42);
  });

  it("deja el residuo de redondeo en la última cuota", () => {
    const amounts = splitInstallments(50.23, 10);
    expect(amounts.slice(0, 9).every((amount) => amount === 5.02)).toBe(true);
    expect(amounts[9]).toBe(5.05);
    expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBeCloseTo(50.23, 2);
  });

  it("prorratea la cancelación por los días no corridos", () => {
    const start = day("2026-01-01");
    const end = day("2027-01-01");
    const effective = day("2026-10-01");
    expect(calendarDaysBetween(effective, end)).toBe(92);
    expect(unearnedFactor(start, end, effective)).toBeCloseTo(92 / 365, 8);

    const result = terminationResult({
      kind: "CANCELLATION",
      premium: parts,
      termStart: start,
      termEnd: end,
      effectiveDate: effective,
      paid: 0,
    });
    expect(result.creditAffected).toBeCloseTo(-4.2849, 4);
    expect(result.creditExempt).toBeCloseTo(-7.5616, 4);
    expect(result.balance).toBeGreaterThan(0);
  });
});

describe("terminationResult", () => {
  const premium = { affected: 17, exempt: 30 };

  it("en una anulación el saldo es la devolución de lo pagado", () => {
    const result = terminationResult({
      kind: "ANNULMENT",
      premium,
      termStart: day("2026-01-01"),
      termEnd: day("2027-01-01"),
      effectiveDate: day("2026-01-01"),
      paid: 10,
    });
    expect(result.remainingGross).toBe(0);
    expect(result.balance).toBe(-10);
  });
});

describe("commissionTolerance", () => {
  it("usa el mayor entre 0,5 % y 0,01", () => {
    expect(commissionTolerance(1)).toBe(0.01);
    expect(commissionTolerance(100)).toBe(0.5);
    expect(withinCommissionTolerance(100, 99.6)).toBe(true);
    expect(withinCommissionTolerance(100, 99)).toBe(false);
  });
});
