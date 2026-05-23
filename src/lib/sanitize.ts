import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitiza HTML proveniente del RichTextEditor antes de persistir.
 * Permite el subset que el editor produce (formateo básico, listas,
 * tablas, alineaciones, links e imágenes con src http/https).
 */
export function sanitizeRichText(input: string | null | undefined): string {
  if (!input) return "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "code",
      "pre",
      "blockquote",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "span",
      "div",
    ],
    ALLOWED_ATTR: [
      "href",
      "src",
      "alt",
      "title",
      "target",
      "rel",
      "class",
      "style",
      "colspan",
      "rowspan",
    ],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/|#)/i,
  });
}
