import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  parseBrokerisFile,
  sha256Hex,
} from "@/lib/domain/brokeris-file";
import { translateBrokerisPaste } from "@/lib/domain/brokeris-translate";

describe("archivos Brokeris", () => {
  it("convierte CSV con separadores citados a la matriz esperada", () => {
    const bytes = Buffer.from(
      'id;tipo;poliza;vigencia;delta;detalle\r\ne-1;11;POL-1;2026-01-01;0;"Baja; solicitada"',
      "utf8",
    );

    const parsed = parseBrokerisFile(bytes, "endosos.csv");

    expect(parsed.matrix[1]).toEqual([
      "e-1",
      "11",
      "POL-1",
      "2026-01-01",
      "0",
      "Baja; solicitada",
    ]);
    expect(translateBrokerisPaste("ENDOSOS", parsed.text)[0]).toMatchObject({
      action: "TRADUCIDO",
      payload: { id: "e-1", code: "CANCELLATION", policyNumber: "POL-1" },
    });
  });

  it("convierte TSV sin alterar el orden de columnas", () => {
    const bytes = Buffer.from(
      "id\testado\tsubestado\tcierre\tpoliza\tdetalle\ns-1\t5\t9\t7\tPOL-9\tCerrado",
    );

    const parsed = parseBrokerisFile(bytes, "siniestros.tsv");

    expect(parsed.text.split("\n")[1]).toBe("s-1\t5\t9\t7\tPOL-9\tCerrado");
    expect(translateBrokerisPaste("SINIESTROS", parsed.text)[0]?.payload).toMatchObject({
      id: "s-1",
      status: "CLOSED",
      policyNumber: "POL-9",
    });
  });

  it("lee solo la primera hoja XLSX", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["id", "tipo", "motivo", "poliza"],
        ["nr-1", 2, 22, "POL-20"],
      ]),
      "Carga",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["no", "debe", "aparecer"]]),
      "Auxiliar",
    );
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const parsed = parseBrokerisFile(bytes, "no-renovacion.xlsx");

    expect(parsed.matrix).toHaveLength(2);
    expect(parsed.text).not.toContain("aparecer");
    expect(translateBrokerisPaste("NO_RENOVACION", parsed.text)[0]).toMatchObject({
      action: "TRADUCIDO",
      payload: { id: "nr-1", type: "NOT_RENEWED", reason: "CLIENT_REQUEST" },
    });
  });

  it("calcula SHA-256 sobre los bytes originales y rechaza extensiones ajenas", () => {
    expect(sha256Hex(Buffer.from("brokeris"))).toBe(
      "079ac05fb138211b759b30331b0494c12a096b4c17454a761dead577d6bc4f12",
    );
    expect(() => parseBrokerisFile(Buffer.from("id"), "datos.xls")).toThrow(
      "Formato no soportado",
    );
  });
});
