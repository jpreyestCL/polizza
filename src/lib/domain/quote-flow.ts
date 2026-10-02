/**
 * Solicitud de cotización. El cliente acepta y nace una propuesta en
 * elaboración. Perdida exige motivo.
 */

export const QUOTE_STATUSES = [
  "BORRADOR",
  "SOLICITADA",
  "COTIZADA",
  "ENVIADA_CLIENTE",
  "GANADA",
  "PERDIDA",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

const NEXT: Record<QuoteStatus, QuoteStatus[]> = {
  BORRADOR: ["SOLICITADA"],
  SOLICITADA: ["COTIZADA"],
  COTIZADA: ["ENVIADA_CLIENTE"],
  ENVIADA_CLIENTE: ["GANADA", "PERDIDA"],
  GANADA: [],
  PERDIDA: [],
};

export function canMoveQuote(from: string, to: string): boolean {
  if (!(from in NEXT)) return false;
  return NEXT[from as QuoteStatus].includes(to as QuoteStatus);
}

export function quoteNeedsOffer(to: string): boolean {
  return to === "COTIZADA" || to === "ENVIADA_CLIENTE" || to === "GANADA";
}
