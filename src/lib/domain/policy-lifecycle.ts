/**
 * Estados de la especificación. La póliza es la misma fila desde el
 * borrador: la propuesta es la ficha con la que se llena.
 */

export type SpecPolicyState =
  | "DRAFT"
  | "SENT_TO_INSURER"
  | "ISSUED"
  | "REJECTED_BY_INSURER"
  | "CANCELLED"
  | "ANNULLED"
  | "DISCARDED";

const PROPOSAL_STATE: Record<string, SpecPolicyState> = {
  ELABORACION: "DRAFT",
  POR_ENVIAR: "DRAFT",
  DEVUELTA: "DRAFT",
  ENVIADA_COMPANIA: "SENT_TO_INSURER",
  RECHAZADA: "REJECTED_BY_INSURER",
  POR_DESPACHAR: "ISSUED",
  DESCARTADA: "DISCARDED",
};

const POLICY_STATE: Record<string, SpecPolicyState> = {
  BORRADOR: "DRAFT",
  ENVIADA: "SENT_TO_INSURER",
  POR_DESPACHAR: "ISSUED",
  RECHAZADA: "REJECTED_BY_INSURER",
  DESCARTADA: "DISCARDED",
  VIGENTE: "ISSUED",
  VENCIDA: "ISSUED",
  RENOVADA: "ISSUED",
  CANCELADA: "CANCELLED",
  ANULADA: "ANNULLED",
};

export function specStateOfProposal(status: string): SpecPolicyState | null {
  return PROPOSAL_STATE[status] ?? null;
}

export function specStateOfPolicy(status: string): SpecPolicyState | null {
  return POLICY_STATE[status] ?? null;
}

export const PRE_ISSUE_POLICY_STATUSES = [
  "BORRADOR",
  "ENVIADA",
  "POR_DESPACHAR",
  "RECHAZADA",
  "DESCARTADA",
] as const;

export function isPreIssuePolicy(status: string): boolean {
  return (PRE_ISSUE_POLICY_STATUSES as readonly string[]).includes(status);
}

/** La cartera por defecto esconde lo que aún no emitió la compañía. */
export const HIDDEN_FROM_CARTERA = [
  "BORRADOR",
  "ENVIADA",
  "RECHAZADA",
  "DESCARTADA",
] as const;

const DISCARDABLE = new Set([
  "ELABORACION",
  "POR_ENVIAR",
  "DEVUELTA",
  "RECHAZADA",
]);

export function canDiscardProposal(status: string): boolean {
  return DISCARDABLE.has(status);
}

export type ReopenIssueFacts = {
  issuedEndorsements: number;
  appliedPayments: number;
  commissionAllocations: number;
  sentDispatches: number;
};

/** TR-POL-12. Cualquier hecho posterior bloquea la reapertura de la emisión. */
export function reopenIssueBlockers(facts: ReopenIssueFacts): string[] {
  const blockers: string[] = [];
  if (facts.issuedEndorsements > 0) {
    blockers.push("Tiene endosos emitidos.");
  }
  if (facts.appliedPayments > 0) {
    blockers.push("Tiene pagos aplicados o cuotas presuntas.");
  }
  if (facts.commissionAllocations > 0) {
    blockers.push("Tiene comisiones ya asignadas.");
  }
  if (facts.sentDispatches > 0) {
    blockers.push("El despacho al cliente ya se envió.");
  }
  return blockers;
}
