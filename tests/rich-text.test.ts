import { describe, it, expect } from "vitest";
import { htmlToPlainText, isHtml } from "@/lib/rich-text";

describe("htmlToPlainText", () => {
  it("quita las etiquetas del editor para mostrar en listados", () => {
    expect(htmlToPlainText("<p>Conteiner destinado a oficina</p>")).toBe(
      "Conteiner destinado a oficina",
    );
  });

  it("deja el texto plano intacto", () => {
    const plano = "Conteiner destinado a oficina, hasta UF 100";
    expect(htmlToPlainText(plano)).toBe(plano);
  });

  it("marca los ítems de lista con viñeta", () => {
    expect(htmlToPlainText("<ul><li>uno</li><li>dos</li></ul>")).toBe("• uno • dos");
  });

  it("decodifica entidades, incluidos los acentos", () => {
    expect(htmlToPlainText("<p>Da&ntilde;os &amp; p&eacute;rdidas</p>")).toBe(
      "Daños & pérdidas",
    );
  });

  it("no confunde comparaciones con etiquetas", () => {
    expect(isHtml("Monto < 100 y > 50")).toBe(false);
    expect(htmlToPlainText("Monto < 100 y > 50")).toBe("Monto < 100 y > 50");
  });

  it("colapsa el espacio de varios párrafos", () => {
    expect(htmlToPlainText("<p>Uno</p><p>Dos</p>")).toBe("Uno Dos");
  });

  it("tolera vacío", () => {
    expect(htmlToPlainText("")).toBe("");
  });
});
