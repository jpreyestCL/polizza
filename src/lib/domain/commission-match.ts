import { commissionTolerance, roundHalfUp } from "@/lib/domain/money";

/**
 * Calce N:M. Una línea de liquidación puede partirse entre varios
 * esperados y un esperado puede recibir varias líneas. El residuo menor
 * que la tolerancia de comisión se acepta y no queda como diferencia.
 */

export type MatchLine = {
  id: string;
  policyNumber: string | null;
  amount: number;
  currency: string;
};

export type MatchReceivable = {
  id: string;
  policyNumber: string | null;
  amount: number;
  currency: string;
  allocated?: number;
};

export type CommissionMatch = {
  lineId: string;
  receivableId: string;
  amount: number;
};

function samePolicy(line: MatchLine, receivable: MatchReceivable): boolean {
  if (!line.policyNumber || !receivable.policyNumber) return false;
  return line.policyNumber.trim() === receivable.policyNumber.trim();
}

export function matchCommissionLines(
  lines: MatchLine[],
  receivables: MatchReceivable[],
): CommissionMatch[] {
  const open = receivables.map((receivable) => ({
    ...receivable,
    left: roundHalfUp(receivable.amount - (receivable.allocated ?? 0), 4),
  }));
  const matches: CommissionMatch[] = [];

  for (const line of lines) {
    let left = roundHalfUp(line.amount, 4);
    const pool = open.filter(
      (receivable) =>
        receivable.left > 0.00005 &&
        receivable.currency === line.currency &&
        samePolicy(line, receivable),
    );
    for (const receivable of pool) {
      if (left <= 0.00005) break;
      const take = roundHalfUp(Math.min(left, receivable.left), 4);
      if (take <= 0.00005) continue;
      matches.push({
        lineId: line.id,
        receivableId: receivable.id,
        amount: take,
      });
      receivable.left = roundHalfUp(receivable.left - take, 4);
      left = roundHalfUp(left - take, 4);
    }
    if (left > 0.00005 && left <= commissionTolerance(line.amount) + 1e-9) {
      left = 0;
    }
  }

  return matches;
}
