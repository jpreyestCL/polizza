import { premiumTotals, roundHalfUp, VAT_RATE, type PremiumParts } from "./money";
import { unearnedFactor } from "./term";

export type TerminationKind = "CANCELLATION" | "ANNULMENT";

export type TerminationInput = {
  kind: TerminationKind;
  premium: PremiumParts;
  termStart: Date | null;
  termEnd: Date | null;
  effectiveDate: Date;
  paid: number;
  writtenOff?: number;
  vatRate?: number;
};

export type TerminationResult = {
  unearnedFactor: number;
  creditAffected: number;
  creditExempt: number;
  creditGross: number;
  remainingGross: number;
  balance: number;
  isEstimate: true;
};

/**
 * Saldo único al cancelar o anular.
 * Positivo: el cliente aún debe la prima devengada.
 * Negativo: corresponde devolución.
 * La anulación devuelve el 100 %. La cancelación prorratea por días no corridos.
 */
export function terminationResult(input: TerminationInput): TerminationResult {
  const vatRate = input.vatRate ?? VAT_RATE;
  const original = premiumTotals(input.premium, vatRate);
  const factor =
    input.kind === "ANNULMENT"
      ? 1
      : input.termStart && input.termEnd
        ? unearnedFactor(input.termStart, input.termEnd, input.effectiveDate)
        : 1;

  const creditAffected = roundHalfUp(original.affected * factor, 4);
  const creditExempt = roundHalfUp(original.exempt * factor, 4);
  const creditVat = roundHalfUp(creditAffected * vatRate, 4);
  const creditGross = creditAffected + creditVat + creditExempt;
  const remainingGross = roundHalfUp(original.gross - creditGross, 4);
  const writtenOff = input.writtenOff ?? 0;
  const balance = roundHalfUp(remainingGross - input.paid - writtenOff, 4);

  return {
    unearnedFactor: factor,
    creditAffected: -creditAffected,
    creditExempt: -creditExempt,
    creditGross: -creditGross,
    remainingGross,
    balance,
    isEstimate: true,
  };
}
