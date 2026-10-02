import type { SuccessorState } from "./renewal-status";

const OPEN_PROPOSAL_STATUSES = new Set([
  "ELABORACION",
  "POR_ENVIAR",
  "ENVIADA_COMPANIA",
  "DEVUELTA",
  "POR_DESPACHAR",
]);

/**
 * La sucesora emitida es una póliza hija que no quedó anulada.
 * Una propuesta de renovación abierta deja la póliza en gestión.
 * Una hija anulada, sin otra sucesora, es una renovación perdida.
 */
export function successorState(input: {
  childStatuses: string[];
  proposalStatuses: string[];
}): SuccessorState {
  if (input.childStatuses.some((status) => status !== "ANULADA")) return "ISSUED";
  if (input.proposalStatuses.some((status) => OPEN_PROPOSAL_STATUSES.has(status))) {
    return "IN_PROGRESS";
  }
  if (input.childStatuses.length > 0) return "LOST";
  return "NONE";
}
