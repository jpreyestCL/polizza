import { describe, it, expect } from "vitest";
import React from "react";
import { renderToBuffer, Document, Page, View } from "@react-pdf/renderer";
import { RichText } from "@/features/proposal-pdf/rich-text-pdf";

/**
 * El PDF de la propuesta es lo que se manda a la compañía: si el render se cae
 * o imprime etiquetas, el daño es visible hacia afuera. Este test renderiza de
 * verdad un documento con texto enriquecido.
 */
describe("RichText en el PDF", () => {
  it("renderiza un documento real con formato, listas y color", async () => {
    const html =
      '<p><strong>Conteiner</strong> destinado a oficina hasta <u>UF 100</u>.</p>' +
      '<ul><li>Contenidos: <em>taladros</em></li>' +
      '<li><span style="color: #b42318">Excluye</span> daño por agua</li></ul>';

    const doc = (
      <Document>
        <Page size="A4">
          <View style={{ padding: 20 }}>
            <RichText value={html} baseStyle={{ fontSize: 9 }} />
            <RichText value="Texto plano de siempre, sin HTML" />
          </View>
        </Page>
      </Document>
    );

    const buf = await renderToBuffer(doc);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30000);
});
