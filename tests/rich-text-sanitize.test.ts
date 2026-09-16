import { describe, it, expect } from "vitest";
import { sanitizeRichText } from "@/lib/sanitize";
import { isRichTextFieldType } from "@/lib/rich-text";

/**
 * Los campos de texto largo se guardan como HTML y se renderizan con
 * `dangerouslySetInnerHTML`. El editor tiene un modo "código fuente" donde el
 * usuario puede escribir HTML arbitrario, así que la limpieza es lo único que
 * separa eso de un XSS entre usuarios de la misma corredora.
 */
describe("sanitizeRichText", () => {
  it("elimina scripts", () => {
    const out = sanitizeRichText('<p>Hola</p><script>alert(1)</script>');
    expect(out).not.toContain("script");
    expect(out).toContain("Hola");
  });

  it("elimina manejadores de evento inline", () => {
    const out = sanitizeRichText('<img src="x" onerror="alert(1)">');
    expect(out.toLowerCase()).not.toContain("onerror");
  });

  it("bloquea javascript: en enlaces", () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">click</a>');
    expect(out.toLowerCase()).not.toContain("javascript:");
  });

  it("elimina iframes", () => {
    expect(sanitizeRichText('<iframe src="https://evil.tld"></iframe>')).not.toContain(
      "iframe",
    );
  });

  it("conserva el formato legítimo del editor", () => {
    const html =
      '<p><strong>Importante</strong>: <em>revisar</em> <u>antes</u></p>' +
      '<ul><li>uno</li></ul>' +
      '<span style="color: #b42318">rojo</span>';
    const out = sanitizeRichText(html);
    expect(out).toContain("<strong>");
    expect(out).toContain("<em>");
    expect(out).toContain("<u>");
    expect(out).toContain("<li>");
    expect(out).toContain("color");
  });

  it("tolera null y vacío", () => {
    expect(sanitizeRichText(null)).toBe("");
    expect(sanitizeRichText(undefined)).toBe("");
    expect(sanitizeRichText("")).toBe("");
  });
});

describe("isRichTextFieldType — regla única cliente/servidor", () => {
  it("marca como HTML los campos de texto largo", () => {
    expect(isRichTextFieldType("textarea")).toBe(true);
    expect(isRichTextFieldType("richtext")).toBe(true);
  });

  it("no toca los demás tipos", () => {
    for (const t of ["text", "select", "number", "date", "checkbox"]) {
      expect(isRichTextFieldType(t)).toBe(false);
    }
  });
});
