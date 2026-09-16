import { describe, it, expect } from "vitest";
import { parseRichText, looksLikeHtml } from "@/features/proposal-pdf/rich-text-pdf";

describe("looksLikeHtml", () => {
  it("reconoce el HTML del editor", () => {
    expect(looksLikeHtml("<p>Conteiner destinado a oficina</p>")).toBe(true);
    expect(looksLikeHtml("<ul><li>uno</li></ul>")).toBe(true);
  });

  it("deja pasar el texto plano de los ítems ya cargados", () => {
    expect(looksLikeHtml("Conteiner destinado a oficina, hasta UF 100")).toBe(false);
    expect(looksLikeHtml("Monto < 100 y > 50")).toBe(false);
  });
});

describe("parseRichText", () => {
  it("separa párrafos", () => {
    const blocks = parseRichText("<p>Primero</p><p>Segundo</p>");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].tokens[0]).toMatchObject({ text: "Primero" });
    expect(blocks[1].tokens[0]).toMatchObject({ text: "Segundo" });
  });

  it("conserva negrita, cursiva y subrayado", () => {
    const [b] = parseRichText(
      "<p><strong>Importante</strong> y <em>además</em> <u>sub</u></p>",
    );
    const styles = b.tokens.filter((t) => t.kind === "text").map((t: any) => t.style);
    expect(styles[0].bold).toBe(true);
    expect(styles.some((s: any) => s.italic)).toBe(true);
    expect(styles.some((s: any) => s.underline)).toBe(true);
  });

  it("toma el color de un span", () => {
    const [b] = parseRichText('<p><span style="color: #b42318">Exclusión</span></p>');
    const t: any = b.tokens.find((x) => x.kind === "text");
    expect(t.style.color).toBe("#b42318");
  });

  it("numera las listas ordenadas y marca viñetas en las no ordenadas", () => {
    const ol = parseRichText("<ol><li>uno</li><li>dos</li></ol>");
    expect(ol.map((b) => b.bullet)).toEqual(["1.", "2."]);
    const ul = parseRichText("<ul><li>a</li><li>b</li></ul>");
    expect(ul.map((b) => b.bullet)).toEqual(["•", "•"]);
  });

  it("decodifica entidades", () => {
    const [b] = parseRichText("<p>Da&ntilde;os &amp; p&eacute;rdidas</p>");
    expect((b.tokens[0] as any).text).toBe("Daños & pérdidas");
  });

  it("no deja bloques vacíos por los párrafos en blanco del editor", () => {
    expect(parseRichText("<p></p><p>  </p>")).toHaveLength(0);
  });

  it("anida estilos sin perder el de afuera", () => {
    const [b] = parseRichText("<p><strong>muy <em>importante</em></strong></p>");
    const inner: any = b.tokens.find((t: any) => t.text === "importante");
    expect(inner.style.bold).toBe(true);
    expect(inner.style.italic).toBe(true);
  });
});
