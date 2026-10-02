import type { SuccessorState } from "./renewal-status";

const OPEN_PROPOSAL_STATUSES = new Set([
  "ELABORACION",
  "POR_ENVIAR",
  "ENVIADA_COMPANIA",
  "DEVUELTA",
  "POR_DESPACHAR",
]);

const ISSUED_CHILD = new Set(["VIGENTE", "VENCIDA", "RENOVADA"]);
const OPEN_CHILD = new Set(["BORRADOR", "ENVIADA", "POR_DESPACHAR"]);
const LOST_CHILD = new Set(["ANULADA", "CANCELADA", "RECHAZADA", "DESCARTADA"]);
const LOST_PROPOSAL = new Set(["RECHAZADA", "DESCARTADA"]);

/**
 * La sucesora emitida, o cancelada después de haber empezado a regir,
 * deja el origen renovado. Una propuesta abierta es gestión. Rechazo,
 * descarte, anulación o cancelación desde el inicio dejan la renovación
 * perdida y el origen vuelve a la cola.
 */
export function successorState(input: {
  childStatuses: string[];
  proposalStatuses: string[];
  cancelledAfterStart?: boolean;
}): SuccessorState {
  if (
    input.cancelledAfterStart ||
    input.childStatuses.some((status) => ISSUED_CHILD.has(status))
  ) {
    return "ISSUED";
  }
  if (
    input.childStatuses.some((status) => OPEN_CHILD.has(status)) ||
    input.proposalStatuses.some((status) => OPEN_PROPOSAL_STATUSES.has(status))
  ) {
    return "IN_PROGRESS";
  }
  if (
    input.childStatuses.some((status) => LOST_CHILD.has(status)) ||
    input.proposalStatuses.some((status) => LOST_PROPOSAL.has(status))
  ) {
    return "LOST";
  }
  return "NONE";
}

const SENT_PROPOSAL = new Set(["ENVIADA_COMPANIA", "POR_DESPACHAR"]);

/** True si la sucesora abierta ya salió hacia la compañía. */
export function successorWasSent(proposalStatuses: string[]): boolean {
  const open = proposalStatuses.filter((status) => OPEN_PROPOSAL_STATUSES.has(status));
  return open.length > 0 && open.every((status) => SENT_PROPOSAL.has(status));
}
