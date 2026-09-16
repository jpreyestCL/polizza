/**
 * Utilidades de texto enriquecido compartidas entre cliente y servidor.
 *
 * Los campos de texto largo (materia asegurada, glosas, descripciones) se
 * guardan como HTML del editor. En los listados, resúmenes y tooltips hay que
 * mostrar el texto sin etiquetas; el formato solo se despliega donde se puede
 * renderizar (el editor y el PDF de la propuesta).
 */

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&aacute;": "á",
  "&eacute;": "é",
  "&iacute;": "í",
  "&oacute;": "ó",
  "&uacute;": "ú",
  "&ntilde;": "ñ",
  "&Aacute;": "Á",
  "&Eacute;": "É",
  "&Iacute;": "Í",
  "&Oacute;": "Ó",
  "&Uacute;": "Ú",
  "&Ntilde;": "Ñ",
};

/** ¿El valor guardado viene del editor de texto enriquecido? */
export function isHtml(value: string): boolean {
  return /<\/?(p|br|strong|b|em|i|u|s|ul|ol|li|h[1-3]|span|div|a)\b[^>]*>/i.test(
    value,
  );
}

/**
 * HTML → texto plano legible. Los saltos de bloque se vuelven espacios porque
 * el destino son celdas de tabla y resúmenes de una línea.
 */
export function htmlToPlainText(value: string): string {
  if (!value) return "";
  if (!isHtml(value)) return value;
  return value
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/(p|div|li|h[1-3]|tr)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m] ?? ENTITIES[m.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}
