/**
 * Número de propuesta. Los borradores se crean con un placeholder interno
 * `DRAFT-<timestamp>` que NO debe mostrarse al usuario: el número real se
 * asigna recién al numerar la propuesta (ver `assignProposalNumber`).
 */

const DRAFT_PREFIX = "DRAFT-";

/** True si la propuesta aún no tiene número real asignado. */
export function isDraftProposalNumber(
  proposalNumber: string | null | undefined,
): boolean {
  return !proposalNumber || proposalNumber.startsWith(DRAFT_PREFIX);
}

/**
 * Etiqueta a mostrar para el número de propuesta. Para borradores devuelve
 * "Borrador" en vez del timestamp interno.
 */
export function formatProposalNumber(
  proposalNumber: string | null | undefined,
): string {
  return isDraftProposalNumber(proposalNumber)
    ? "Borrador"
    : (proposalNumber as string);
}
