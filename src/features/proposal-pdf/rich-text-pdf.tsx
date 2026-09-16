import type { ComponentProps } from "react";
import { Text, View } from "@react-pdf/renderer";

/**
 * El tipo Style de react-pdf no se exporta suelto. Se deriva de View, que a
 * diferencia de Text no tiene una variante SVG en su prop `style`.
 */
type PdfStyle = Exclude<
  NonNullable<ComponentProps<typeof View>["style"]>,
  readonly unknown[]
>;

/**
 * Renderiza el HTML del editor de texto enriquecido dentro del PDF.
 *
 * `@react-pdf/renderer` no entiende HTML: si se le pasa la cadena tal cual,
 * imprime las etiquetas literales en el documento que va a la compañía. Este
 * módulo traduce el subconjunto que produce TipTap (párrafos, negrita,
 * cursiva, subrayado, tachado, color, listas y títulos) a nodos de react-pdf.
 *
 * Deliberadamente simple: el HTML de origen es el de un editor controlado, no
 * HTML arbitrario de internet.
 */

type Style = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
};

type Token =
  | { kind: "text"; text: string; style: Style }
  | { kind: "break" };

/** ¿Vale la pena parsear esto como HTML? */
export function looksLikeHtml(value: string): boolean {
  return /<\/?(p|br|strong|b|em|i|u|s|ul|ol|li|h[1-3]|span|div|a)\b[^>]*>/i.test(
    value,
  );
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&aacute;": "á", "&eacute;": "é", "&iacute;": "í",
  "&oacute;": "ó", "&uacute;": "ú", "&ntilde;": "ñ",
};

function decodeEntities(s: string): string {
  return s.replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

/** Bloque = un párrafo, título o ítem de lista ya resuelto a tokens. */
type Block = { bullet: string | null; heading: boolean; tokens: Token[] };

/**
 * Parser por tokens. Recorre el HTML una sola vez manteniendo una pila de
 * estilos activos; no construye un árbol porque no hace falta para el
 * subconjunto soportado.
 */
export function parseRichText(html: string): Block[] {
  const blocks: Block[] = [];
  let current: Block = { bullet: null, heading: false, tokens: [] };
  const stack: Style[] = [];
  let olIndex = 0;
  let inOrderedList = false;

  const styleNow = (): Style =>
    stack.reduce<Style>((acc, s) => ({ ...acc, ...s }), {});

  const flush = () => {
    if (current.tokens.some((t) => t.kind === "break" || t.text.trim() !== "")) {
      blocks.push(current);
    }
    current = { bullet: null, heading: false, tokens: [] };
  };

  const re = /<\/?([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const [, rawTag, attrs, text] = m;

    if (text !== undefined) {
      const decoded = decodeEntities(text).replace(/\s+/g, " ");
      if (decoded !== "") {
        current.tokens.push({ kind: "text", text: decoded, style: styleNow() });
      }
      continue;
    }

    const tag = rawTag.toLowerCase();
    const closing = m[0].startsWith("</");

    switch (tag) {
      case "br":
        current.tokens.push({ kind: "break" });
        break;
      case "p":
      case "div":
        if (closing) flush();
        break;
      case "h1":
      case "h2":
      case "h3":
        if (closing) flush();
        else current.heading = true;
        break;
      case "ul":
        if (!closing) inOrderedList = false;
        break;
      case "ol":
        if (closing) inOrderedList = false;
        else { inOrderedList = true; olIndex = 0; }
        break;
      case "li":
        if (closing) flush();
        else {
          current.bullet = inOrderedList ? `${++olIndex}.` : "•";
        }
        break;
      case "strong":
      case "b":
        if (closing) stack.pop();
        else stack.push({ bold: true });
        break;
      case "em":
      case "i":
        if (closing) stack.pop();
        else stack.push({ italic: true });
        break;
      case "u":
        if (closing) stack.pop();
        else stack.push({ underline: true });
        break;
      case "s":
      case "del":
        if (closing) stack.pop();
        else stack.push({ strike: true });
        break;
      case "span":
      case "a": {
        if (closing) stack.pop();
        else {
          const color = /color:\s*([^;"']+)/i.exec(attrs ?? "")?.[1]?.trim();
          stack.push(color ? { color } : {});
        }
        break;
      }
      default:
        break;
    }
  }
  flush();
  return blocks;
}

function tokenStyle(s: Style): PdfStyle {
  const decoration =
    s.underline && s.strike
      ? ("underline line-through" as const)
      : s.underline
        ? ("underline" as const)
        : s.strike
          ? ("line-through" as const)
          : undefined;
  return {
    fontWeight: s.bold ? ("bold" as const) : undefined,
    fontStyle: s.italic ? ("italic" as const) : undefined,
    textDecoration: decoration,
    color: s.color,
  };
}

/**
 * Pinta el HTML como texto con formato. Si el valor no parece HTML se imprime
 * tal cual, para no tocar los campos que siguen siendo texto plano.
 */
export function RichText({
  value,
  baseStyle,
}: {
  value: string;
  baseStyle?: PdfStyle;
}) {
  if (!looksLikeHtml(value)) return <Text style={baseStyle}>{value}</Text>;

  const blocks = parseRichText(value);
  if (blocks.length === 0) return null;

  return (
    <View>
      {blocks.map((b, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            marginBottom: 1,
            paddingLeft: b.bullet ? 6 : 0,
          }}
        >
          {b.bullet && (
            <Text style={{ ...baseStyle, width: 10 }}>{b.bullet}</Text>
          )}
          <Text
            style={{
              ...baseStyle,
              flex: 1,
              ...(b.heading ? { fontWeight: "bold" } : {}),
            }}
          >
            {b.tokens.map((t, j) =>
              t.kind === "break" ? (
                <Text key={j}>{"\n"}</Text>
              ) : (
                <Text key={j} style={tokenStyle(t.style)}>
                  {t.text}
                </Text>
              ),
            )}
          </Text>
        </View>
      ))}
    </View>
  );
}
