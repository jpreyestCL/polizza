import type { ProposalStatus } from "@prisma/client";
import { businessDaysBetween } from "@/lib/working-days";

export type SlaLevel = "none" | "warning" | "critical";

/**
 * SLA de una propuesta. La alerta aplica solo en ENVIADA_COMPANIA:
 * ≥5 días hábiles → advertencia; ≥10 → crítica.
 */
export function proposalSla(
  status: ProposalStatus,
  currentStateStartedAt: Date,
  holidays: Set<string>,
  now: Date = new Date(),
): { daysInState: number; level: SlaLevel } {
  const daysInState = businessDaysBetween(currentStateStartedAt, now, holidays);
  if (status !== "ENVIADA_COMPANIA") {
    return { daysInState, level: "none" };
  }
  if (daysInState >= 10) return { daysInState, level: "critical" };
  if (daysInState >= 5) return { daysInState, level: "warning" };
  return { daysInState, level: "none" };
}
