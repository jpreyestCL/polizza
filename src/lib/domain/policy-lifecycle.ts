/**
 * Estados de la especificación sobre los estados que ya guarda la app.
 * La propuesta sigue siendo el expediente; la póliza es el documento de cartera.
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
