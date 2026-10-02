import { roundHalfUp } from "@/lib/domain/money";
import { unearnedFactor } from "@/lib/domain/term";

/** Siniestralidad = (pagado + estimado abierto) / prima neta devengada. */
export function lossRatio(
  paidIndemnity: number,
  openEstimate: number,
  earnedNet: number,
): number | null {
  if (!(earnedNet > 0)) return null;
  return (paidIndemnity + openEstimate) / earnedNet;
}

/** Prima neta devengada a una fecha, con la misma prorrata del término. */
export function earnedNetAt(
  premiumNet: number,
  termStart: Date,
  termEnd: Date,
  at: Date,
): number {
  const unearned = unearnedFactor(termStart, termEnd, at);
  return roundHalfUp(premiumNet * (1 - unearned), 4);
}
