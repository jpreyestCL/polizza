import { describe, expect, it } from "vitest";
import {
  validateItemData,
} from "@/features/proposal-items/schemas";
import type { BranchFieldDef } from "@/features/proposal-items/queries";

const FIELDS_VEHICULO: BranchFieldDef[] = [
  {
    id: "f1",
    fieldKey: "patente",
    label: "Patente",
    type: "text",
    required: true,
    order: 0,
    options: null,
    helpText: null,
  },
  {
    id: "f2",
    fieldKey: "anio",
    label: "Año",
    type: "number",
    required: false,
    order: 1,
    options: null,
    helpText: null,
  },
  {
    id: "f3",
    fieldKey: "uso",
    label: "Uso",
    type: "select",
    required: false,
    order: 2,
    options: [
      { value: "PARTICULAR", label: "Particular" },
      { value: "COMERCIAL", label: "Comercial" },
    ],
    helpText: null,
  },
];

describe("validateItemData", () => {
  it("falla si falta un campo requerido", () => {
    const r = validateItemData(FIELDS_VEHICULO, { anio: "2020" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Patente");
  });

  it("acepta un payload válido", () => {
    const r = validateItemData(FIELDS_VEHICULO, {
      patente: "ABCD12",
      anio: "2020",
      uso: "PARTICULAR",
    });
    expect(r.ok).toBe(true);
  });

  it("rechaza número inválido", () => {
    const r = validateItemData(FIELDS_VEHICULO, {
      patente: "ABCD12",
      anio: "veinte",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Año");
  });

  it("rechaza valor fuera de las opciones del select", () => {
    const r = validateItemData(FIELDS_VEHICULO, {
      patente: "ABCD12",
      uso: "OTRO_VALOR",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Uso");
  });

  it("acepta required vacío si no es required", () => {
    const r = validateItemData(FIELDS_VEHICULO, { patente: "ABCD12" });
    expect(r.ok).toBe(true);
  });
});
