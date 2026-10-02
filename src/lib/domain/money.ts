/**
 * Dinero de la corredora. Funciones puras alineadas al ejemplo de la
 * especificación: IVA solo sobre la prima afecta, redondeo half-up por línea
 * y la última cuota absorbe el residuo.
 */

export const VAT_RATE = 0.19;

/** Tolerancia de comisión: max(0,5 % del esperado, 0,01 en la moneda de la póliza). */
export const COMMISSION_TOLERANCE_PCT = 0.005;
export const COMMISSION_TOLERANCE_MIN = 0.01;

export function roundHalfUp(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return Number.NaN;
  const sign = value < 0 ? -1 : 1;
  const fixed = Math.abs(value).toFixed(decimals + 6);
  const [whole, frac = ""] = fixed.split(".");
  const digits = (frac + "0".repeat(decimals + 1)).slice(0, decimals + 1);
  const keep = digits.slice(0, decimals);
  const next = digits.charCodeAt(decimals) - 48;
  let result = Number(keep ? `${whole}.${keep}` : whole);
  if (next >= 5) {
    const bumped = (result + 10 ** -decimals).toFixed(decimals);
    result = Number(bumped);
  }
  const rounded = sign * result;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export type RateBasis = "PER_MILLE" | "PERCENT";

/** Prima de una cobertura a partir del monto asegurado y la tasa. */
export function premiumFromRate(
  sumInsured: number,
  rate: number,
  basis: RateBasis = "PER_MILLE",
): number {
  const raw = basis === "PERCENT" ? (sumInsured * rate) / 100 : (sumInsured * rate) / 1000;
  return roundHalfUp(raw, 4);
}

export type PremiumParts = {
  affected: number;
  exempt: number;
};

export type PremiumTotals = PremiumParts & {
  vat: number;
  net: number;
  gross: number;
};

/** Agrega primas. El IVA se redondea en la parte afecta; el total no se re-redondea. */
export function premiumTotals(
  parts: PremiumParts,
  vatRate: number = VAT_RATE,
): PremiumTotals {
  const affected = roundHalfUp(parts.affected, 4);
  const exempt = roundHalfUp(parts.exempt, 4);
  const vat = roundHalfUp(affected * vatRate, 4);
  const net = roundHalfUp(affected + exempt, 4);
  const gross = roundHalfUp(affected + vat + exempt, 4);
  return { affected, exempt, vat, net, gross };
}

/** Comisión = afecta × % afecta + exenta × % exenta. */
export function expectedCommission(
  parts: PremiumParts,
  pctAffected: number,
  pctExempt: number,
): { affected: number; exempt: number; total: number } {
  const affected = roundHalfUp((parts.affected * pctAffected) / 100, 4);
  const exempt = roundHalfUp((parts.exempt * pctExempt) / 100, 4);
  return { affected, exempt, total: roundHalfUp(affected + exempt, 4) };
}

/**
 * Reparte un total en N cuotas. Las primeras se redondean y la última
 * absorbe la diferencia para que la suma sea exacta.
 */
export function splitInstallments(
  total: number,
  count: number,
  decimals = 2,
): number[] {
  if (count <= 0) return [];
  const safeTotal = roundHalfUp(total, decimals);
  if (count === 1) return [safeTotal];
  const unit = roundHalfUp(safeTotal / count, decimals);
  const amounts = Array.from({ length: count - 1 }, () => unit);
  const consumed = roundHalfUp(unit * (count - 1), decimals);
  amounts.push(roundHalfUp(safeTotal - consumed, decimals));
  return amounts;
}

export function commissionTolerance(expected: number): number {
  return Math.max(Math.abs(expected) * COMMISSION_TOLERANCE_PCT, COMMISSION_TOLERANCE_MIN);
}

export function withinCommissionTolerance(expected: number, paid: number): boolean {
  return Math.abs(paid - expected) <= commissionTolerance(expected) + 1e-9;
}
