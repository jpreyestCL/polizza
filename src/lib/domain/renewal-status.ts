import { calendarDaysBetween } from "./term";

export type PolicyStatusCode =
  | "VIGENTE"
  | "VENCIDA"
  | "RENOVADA"
  | "CANCELADA"
  | "ANULADA";

/**
 * Estado de renovación derivado. Se evalúa en este orden: una sucesora
 * emitida manda sobre el resto; la no renovación y lo no renovable
 * sacan la póliza de la cola de trabajo.
 */
export const RENEWAL_STATUSES = [
  "RENEWED",
  "IN_PROGRESS",
  "EXPIRED_IN_PROGRESS",
  "NOT_RENEWED",
  "NOT_RENEWABLE",
  "LOST",
  "EXPIRED_UNMANAGED",
  "PENDING",
  "NOT_DUE",
] as const;

export type RenewalStatus = (typeof RENEWAL_STATUSES)[number];

export const RENEWAL_STATUS_LABELS: Record<RenewalStatus, string> = {
  RENEWED: "Renovada",
  IN_PROGRESS: "En gestión",
  EXPIRED_IN_PROGRESS: "Vencida en gestión",
  NOT_RENEWED: "No renovada",
  NOT_RENEWABLE: "No renovable",
  LOST: "Perdida",
  EXPIRED_UNMANAGED: "Vencida sin gestionar",
  PENDING: "Pendiente",
  NOT_DUE: "Fuera de ventana",
};

export const RENEWAL_WINDOW_DAYS = 60;

/** Días antes del fin en que se abre el seguimiento. */
export const RENEWAL_TASK_OFFSETS = [45, 30, 15] as const;

export type RenewalRisk = "AT_RISK" | "OVERDUE";

export const ACTIONABLE_RENEWAL_STATUSES: RenewalStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "EXPIRED_IN_PROGRESS",
  "LOST",
  "EXPIRED_UNMANAGED",
];

export type SuccessorState = "NONE" | "IN_PROGRESS" | "ISSUED" | "LOST";

export type RenewalFacts = {
  policyStatus: PolicyStatusCode;
  endDate: Date | null;
  notRenewable: boolean;
  nonRenewalRecorded: boolean;
  successor: SuccessorState;
  now?: Date;
  windowDays?: number;
};

export function deriveRenewalStatus(facts: RenewalFacts): RenewalStatus {
  const now = facts.now ?? new Date();
  const windowDays = facts.windowDays ?? RENEWAL_WINDOW_DAYS;
  const expired =
    facts.endDate != null && calendarDaysBetween(now, facts.endDate) < 0;

  if (facts.successor === "ISSUED" || facts.policyStatus === "RENOVADA") {
    return "RENEWED";
  }
  if (facts.successor === "IN_PROGRESS") {
    return expired ? "EXPIRED_IN_PROGRESS" : "IN_PROGRESS";
  }
  if (facts.nonRenewalRecorded) return "NOT_RENEWED";
  if (facts.notRenewable) return "NOT_RENEWABLE";
  if (facts.successor === "LOST") return "LOST";
  if (
    facts.policyStatus === "CANCELADA" ||
    facts.policyStatus === "ANULADA"
  ) {
    return "NOT_RENEWABLE";
  }
  if (expired) return "EXPIRED_UNMANAGED";
  if (
    facts.endDate != null &&
    calendarDaysBetween(now, facts.endDate) <= windowDays
  ) {
    return "PENDING";
  }
  return "NOT_DUE";
}

export type RetentionCounts = {
  universe: number;
  renewed: number;
  notRenewable: number;
  pending: number;
  inProgress: number;
  expiredUnmanaged: number;
  notRenewed: number;
  lost: number;
};

export function emptyRetentionCounts(): RetentionCounts {
  return {
    universe: 0,
    renewed: 0,
    notRenewable: 0,
    pending: 0,
    inProgress: 0,
    expiredUnmanaged: 0,
    notRenewed: 0,
    lost: 0,
  };
}

export function addRetentionCount(
  counts: RetentionCounts,
  status: RenewalStatus,
): void {
  counts.universe += 1;
  if (status === "RENEWED") counts.renewed += 1;
  if (status === "NOT_RENEWABLE") counts.notRenewable += 1;
  if (status === "PENDING" || status === "NOT_DUE") counts.pending += 1;
  if (status === "IN_PROGRESS" || status === "EXPIRED_IN_PROGRESS") {
    counts.inProgress += 1;
  }
  if (status === "EXPIRED_UNMANAGED") counts.expiredUnmanaged += 1;
  if (status === "NOT_RENEWED") counts.notRenewed += 1;
  if (status === "LOST") counts.lost += 1;
}

/**
 * Alerta de la cola. Borrador a 15 días, enviada a 3, pendiente a 30.
 * Vencida en gestión o sin gestión es la alerta roja.
 */
export function renewalRisk(input: {
  status: RenewalStatus;
  daysToEnd: number | null;
  successorSent: boolean;
}): RenewalRisk | null {
  if (input.status === "EXPIRED_IN_PROGRESS" || input.status === "EXPIRED_UNMANAGED") {
    return "OVERDUE";
  }
  const days = input.daysToEnd;
  if (days == null || days < 0) return null;
  if (input.status === "PENDING" && days <= 30) return "AT_RISK";
  if (input.status === "IN_PROGRESS" && input.successorSent && days <= 3) return "AT_RISK";
  if (input.status === "IN_PROGRESS" && !input.successorSent && days <= 15) return "AT_RISK";
  return null;
}

/** Renovadas / (universo − no renovables). Null si no hay denominador. */
export function retentionRate(counts: RetentionCounts): number | null {
  const denominator = counts.universe - counts.notRenewable;
  if (denominator <= 0) return null;
  return counts.renewed / denominator;
}
