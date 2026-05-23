/**
 * Reemplaza tokens del patrón de número de propuesta.
 * Módulo puro (sin imports server-only) para uso en cliente y servidor.
 * Tokens:
 *   {YEAR}       → año en 4 dígitos
 *   {SEQ:NNNN}   → secuencia con zero-pad por longitud del patrón
 *   {SEQ}        → secuencia sin formato
 */
export function formatProposalNumber(
  pattern: string,
  year: number,
  seq: number,
): string {
  let out = pattern.replaceAll("{YEAR}", String(year));
  out = out.replace(/\{SEQ:(N+|0+)\}/g, (_m, pad: string) => {
    return String(seq).padStart(pad.length, "0");
  });
  out = out.replaceAll("{SEQ}", String(seq));
  return out;
}
