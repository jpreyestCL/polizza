/**
 * Ciclo del siniestro de la especificación. El estado no se elige a mano:
 * solo valen las transiciones de TR-SIN. Abierto es todo lo que no está
 * cerrado ni anulado.
 */

import { addBusinessDays } from "@/lib/working-days";

export const CLAIM_STATUSES = [
  "REPORTED",
  "AWAITING_ASSIGNMENT",
  "IN_ADJUSTMENT",
  "PAYMENT_PROCESS",
  "CLOSED",
  "VOID",
] as const;

export type ClaimStatusValue = (typeof CLAIM_STATUSES)[number];

export const CLAIM_STATUS_LABELS: Record<ClaimStatusValue, string> = {
  REPORTED: "Aviso recibido, no enviado",
  AWAITING_ASSIGNMENT: "Denunciado, espera asignación",
  IN_ADJUSTMENT: "En liquidación",
  PAYMENT_PROCESS: "Proceso de pago",
  CLOSED: "Cerrado",
  VOID: "Anulado",
};

export const CLAIM_SUBSTATUSES = [
  "REPORT_PENDING_SEND",
  "AWAITING_INSURER_ASSIGNMENT",
  "REPORTED_AND_ASSIGNED",
  "ADJUSTER_NOTIFIED",
  "REQUESTING_DOCUMENTS",
  "AWAITING_DOCUMENTS",
  "INSPECTION_IN_PROGRESS",
  "PENDING_WORKSHOP_ENTRY",
  "AWAITING_ESTIMATE",
  "REPAIR_ORDER_ISSUED",
  "IN_REPAIR",
  "TOTAL_LOSS_DETERMINATION",
  "AWAITING_ADJUSTMENT_REPORT",
  "DISPUTED",
  "AWAITING_INSURER_PAYMENT",
  "PENDING_RELEASE_SIGNATURE",
  "CLOSING_IN_PROGRESS",
  "CLOSED",
] as const;

export type ClaimSubstatus = (typeof CLAIM_SUBSTATUSES)[number];

export const CLAIM_SUBSTATUS_LABELS: Record<ClaimSubstatus, string> = {
  REPORT_PENDING_SEND: "Pendiente de envío",
  AWAITING_INSURER_ASSIGNMENT: "Espera número y liquidador",
  REPORTED_AND_ASSIGNED: "Asignado",
  ADJUSTER_NOTIFIED: "Liquidador avisado",
  REQUESTING_DOCUMENTS: "Pidiendo antecedentes",
  AWAITING_DOCUMENTS: "Espera antecedentes",
  INSPECTION_IN_PROGRESS: "Inspección en curso",
  PENDING_WORKSHOP_ENTRY: "Pendiente ingreso a taller",
  AWAITING_ESTIMATE: "Espera presupuesto",
  REPAIR_ORDER_ISSUED: "Orden de reparación",
  IN_REPAIR: "En reparación",
  TOTAL_LOSS_DETERMINATION: "Pérdida total",
  AWAITING_ADJUSTMENT_REPORT: "Espera informe",
  DISPUTED: "Impugnado",
  AWAITING_INSURER_PAYMENT: "Espera pago de la compañía",
  PENDING_RELEASE_SIGNATURE: "Finiquito para firma",
  CLOSING_IN_PROGRESS: "Cierre en curso",
  CLOSED: "Cerrado",
};

const SUBSTATUS_OF: Record<ClaimStatusValue, readonly ClaimSubstatus[]> = {
  REPORTED: ["REPORT_PENDING_SEND"],
  AWAITING_ASSIGNMENT: ["AWAITING_INSURER_ASSIGNMENT"],
  IN_ADJUSTMENT: [
    "REPORTED_AND_ASSIGNED",
    "ADJUSTER_NOTIFIED",
    "REQUESTING_DOCUMENTS",
    "AWAITING_DOCUMENTS",
    "INSPECTION_IN_PROGRESS",
    "PENDING_WORKSHOP_ENTRY",
    "AWAITING_ESTIMATE",
    "REPAIR_ORDER_ISSUED",
    "IN_REPAIR",
    "TOTAL_LOSS_DETERMINATION",
    "AWAITING_ADJUSTMENT_REPORT",
    "DISPUTED",
  ],
  PAYMENT_PROCESS: [
    "AWAITING_INSURER_PAYMENT",
    "PENDING_RELEASE_SIGNATURE",
    "CLOSING_IN_PROGRESS",
  ],
  CLOSED: ["CLOSED"],
  VOID: [],
};

const NEXT_STATUS: Record<ClaimStatusValue, readonly ClaimStatusValue[]> = {
  REPORTED: ["AWAITING_ASSIGNMENT"],
  AWAITING_ASSIGNMENT: ["IN_ADJUSTMENT"],
  IN_ADJUSTMENT: ["PAYMENT_PROCESS", "CLOSED"],
  PAYMENT_PROCESS: ["CLOSED"],
  CLOSED: [],
  VOID: [],
};

export const CLOSURE_OUTCOMES = [
  "PAID",
  "REPAIRED",
  "BELOW_DEDUCTIBLE",
  "REJECTED",
  "WITHDRAWN",
  "MISSING_DOCUMENTS",
  "NO_PAYMENT_OTHER",
  "PREVENTIVE",
  "DUPLICATE_OR_ERROR",
  "JUDICIAL",
  "TEMPORARY",
  "OTHER",
] as const;

export type ClosureOutcome = (typeof CLOSURE_OUTCOMES)[number];

export const CLOSURE_OUTCOME_LABELS: Record<ClosureOutcome, string> = {
  PAID: "Pagado",
  REPAIRED: "Reparado",
  BELOW_DEDUCTIBLE: "Bajo deducible",
  REJECTED: "Rechazado",
  WITHDRAWN: "Desistido",
  MISSING_DOCUMENTS: "Falta de antecedentes",
  NO_PAYMENT_OTHER: "Cerrado sin pago",
  PREVENTIVE: "Preventivo",
  DUPLICATE_OR_ERROR: "Duplicado o error",
  JUDICIAL: "Judicial",
  TEMPORARY: "Cierre temporal",
  OTHER: "Otro",
};

const NO_PAYMENT_OUTCOMES = new Set<ClosureOutcome>([
  "BELOW_DEDUCTIBLE",
  "REJECTED",
  "WITHDRAWN",
  "MISSING_DOCUMENTS",
  "NO_PAYMENT_OTHER",
  "PREVENTIVE",
  "DUPLICATE_OR_ERROR",
  "JUDICIAL",
  "TEMPORARY",
  "OTHER",
]);

export function isClaimOpen(status: string): boolean {
  return status !== "CLOSED" && status !== "VOID";
}

export function defaultSubstatus(status: ClaimStatusValue): ClaimSubstatus | null {
  return SUBSTATUS_OF[status][0] ?? null;
}

export function substatusesOf(status: string): readonly ClaimSubstatus[] {
  if (!isClaimStatus(status)) return [];
  return SUBSTATUS_OF[status];
}

export function isClaimStatus(status: string): status is ClaimStatusValue {
  return (CLAIM_STATUSES as readonly string[]).includes(status);
}

export function isClosureOutcome(value: string): value is ClosureOutcome {
  return (CLOSURE_OUTCOMES as readonly string[]).includes(value);
}

export function nextClaimStatuses(status: string): ClaimStatusValue[] {
  if (!isClaimStatus(status)) return [];
  return [...NEXT_STATUS[status]];
}

export function claimTransitionError(from: string, to: string): string | null {
  if (from === to) return "El siniestro ya está en ese estado.";
  if (!isClaimStatus(from) || !isClaimStatus(to)) {
    return "INVALID_TRANSITION: ese estado no existe.";
  }
  if (to === "VOID") {
    return "INVALID_TRANSITION: anular se hace con el comando de anulación, y solo desde el aviso o la espera de asignación.";
  }
  if (!NEXT_STATUS[from].includes(to)) {
    return "INVALID_TRANSITION: ese paso no está en el ciclo del siniestro.";
  }
  return null;
}

export function canVoidClaim(status: string): boolean {
  return status === "REPORTED" || status === "AWAITING_ASSIGNMENT";
}

export function canReopenClaim(status: string): boolean {
  return status === "CLOSED";
}

export function closureOutcomesFor(from: string): ClosureOutcome[] {
  if (from === "PAYMENT_PROCESS") return ["PAID", "REPAIRED"];
  if (from === "IN_ADJUSTMENT") return [...NO_PAYMENT_OUTCOMES];
  return [];
}

export function closureOutcomeError(from: string, outcome: string | null | undefined): string | null {
  if (!isClosureOutcome(outcome ?? "")) {
    return "El cierre necesita un resultado.";
  }
  if (!closureOutcomesFor(from).includes(outcome as ClosureOutcome)) {
    return "INVALID_TRANSITION: ese resultado no corresponde a este paso.";
  }
  return null;
}

export function substatusError(status: string, substatus: string): string | null {
  if (!isClaimStatus(status)) return "Estado inválido.";
  if (status === "VOID") return "El anulado conserva el subestado que tenía.";
  if (!(SUBSTATUS_OF[status] as readonly string[]).includes(substatus)) {
    return "Ese subestado no pertenece a este estado.";
  }
  return null;
}

export function addCalendarDays(from: Date, days: number): Date {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** 45 días corridos; 90 si la prima anual supera 100 UF; 180 en casco. */
export function adjustmentLegalDays(input: {
  annualPremiumUf?: number | null;
  hull?: boolean;
}): number {
  if (input.hull) return 180;
  if (input.annualPremiumUf != null && input.annualPremiumUf > 100) return 90;
  return 45;
}

export function adjustmentLegalDeadline(
  reportedToInsurer: Date,
  input: { annualPremiumUf?: number | null; hull?: boolean } = {},
): Date {
  return addCalendarDays(reportedToInsurer, adjustmentLegalDays(input));
}

/** Meta interna. Vehículos y el resto del MVP usan 60 días corridos. */
export const CLAIM_CLOSE_DAYS = 60;

export function closeDeadline(brokerNotifiedAt: Date, closeDays = CLAIM_CLOSE_DAYS): Date {
  return addCalendarDays(brokerNotifiedAt, closeDays);
}

export function closedOnTime(closedAt: Date, deadline: Date | null): boolean | null {
  if (!deadline) return null;
  return utcDay(closedAt) <= utcDay(deadline);
}

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function disputeDeadline(finalReportReceivedAt: Date, holidays: Set<string> = new Set()): Date {
  return addBusinessDays(finalReportReceivedAt, 10, holidays);
}

export function legacyClaimStatus(status: string): ClaimStatusValue {
  switch (status) {
    case "REPORTADO":
      return "REPORTED";
    case "INGRESADO_COMPANIA":
      return "AWAITING_ASSIGNMENT";
    case "EN_EVALUACION":
      return "IN_ADJUSTMENT";
    case "APROBADO":
      return "PAYMENT_PROCESS";
    case "RECHAZADO":
    case "PAGADO":
    case "CERRADO":
      return "CLOSED";
    default:
      return isClaimStatus(status) ? status : "REPORTED";
  }
}
