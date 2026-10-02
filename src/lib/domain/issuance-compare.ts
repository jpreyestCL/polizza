/**
 * Compara lo pedido con lo emitido. La diferencia se registra y la
 * emisión sigue: blocksIssuance es siempre falso.
 */

export type ComparePair = {
  field: string;
  expected: string | number | null;
  actual: string | number | null;
};

export type IssuanceDiscrepancy = {
  field: string;
  expectedValue: string | null;
  actualValue: string | null;
};

export type IssuanceComparison = {
  verdict: "MATCH" | "WITH_PROBLEMS";
  blocksIssuance: false;
  discrepancies: IssuanceDiscrepancy[];
};

function asText(value: string | number | null): string | null {
  if (value == null) return null;
  return String(value);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function asAmount(value: string | number | null): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const trimmed = value.trim().replace(/\s/g, "");
  if (!/^-?\d+(?:[.,]\d+)?$/.test(trimmed)) return null;
  const numeric = Number(trimmed.replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function amountsMatch(expected: number, actual: number): boolean {
  const tolerance = Math.max(0.01, Math.abs(expected) * 0.005);
  return Math.abs(actual - expected) <= tolerance + 1e-9;
}

function pairMatches(pair: ComparePair): boolean {
  const expectedAmount = asAmount(pair.expected);
  const actualAmount = asAmount(pair.actual);
  if (expectedAmount != null && actualAmount != null) {
    return amountsMatch(expectedAmount, actualAmount);
  }
  const expectedText = asText(pair.expected);
  const actualText = asText(pair.actual);
  if (expectedText == null && actualText == null) return true;
  if (expectedText == null || actualText == null) return false;
  return normalizeText(expectedText) === normalizeText(actualText);
}

export function compareIssuance(pairs: ComparePair[]): IssuanceComparison {
  const discrepancies: IssuanceDiscrepancy[] = [];
  for (const pair of pairs) {
    if (pairMatches(pair)) continue;
    discrepancies.push({
      field: pair.field,
      expectedValue: asText(pair.expected),
      actualValue: asText(pair.actual),
    });
  }
  return {
    verdict: discrepancies.length === 0 ? "MATCH" : "WITH_PROBLEMS",
    blocksIssuance: false,
    discrepancies,
  };
}
