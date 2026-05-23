import type { PolicyStatus } from "@prisma/client";

/** Estado de renovación derivado de la fecha de vencimiento. */
export type RenewalLevel = "ok" | "proxima" | "urgente" | "vencida";

function utcMidnight(date: Date): number {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

const DAY_MS = 86_400_000;

/**
 * Calcula los días calendario hasta el vencimiento y el nivel de alerta de
 * renovación. Solo aplica a pólizas VIGENTE con fecha de término:
 * ≤60 días → próxima; ≤30 → urgente; vencida si la fecha ya pasó.
 */
export function renewalInfo(
  status: PolicyStatus,
  endDate: Date | null,
  now: Date = new Date(),
): { daysToExpiry: number | null; level: RenewalLevel } {
  if (status !== "VIGENTE" || !endDate) {
    return { daysToExpiry: null, level: "ok" };
  }
  const days = Math.round(
    (utcMidnight(endDate) - utcMidnight(now)) / DAY_MS,
  );
  let level: RenewalLevel;
  if (days < 0) level = "vencida";
  else if (days <= 30) level = "urgente";
  else if (days <= 60) level = "proxima";
  else level = "ok";
  return { daysToExpiry: days, level };
}

/** True si la póliza requiere atención de renovación. */
export function needsRenewal(level: RenewalLevel): boolean {
  return level === "proxima" || level === "urgente" || level === "vencida";
}
