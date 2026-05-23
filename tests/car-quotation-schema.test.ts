import { describe, it, expect } from "vitest";
import { carQuotationFormSchema } from "@/features/car-quotes/schemas";

const base = {
  clientId: "client-1",
  patente: "AB1234",
  marca: "",
  modelo: "",
  anio: "",
  tipoVehiculo: "",
  motorizacion: "",
  vehicleCondition: "USADO" as const,
  vehicleUse: "PARTICULAR" as const,
  civilLiability: "UF_500" as const,
  workshopType: "EXCLUSIVIDAD" as const,
  deductibles: [],
  insurerKeys: ["bci"],
  assignedUserId: "",
  notes: "",
};

describe("carQuotationFormSchema", () => {
  it("acepta una cotización válida", () => {
    const r = carQuotationFormSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("normaliza patente a mayúsculas", () => {
    const r = carQuotationFormSchema.safeParse({ ...base, patente: "ab12cd" });
    expect(r.success && r.data.patente).toBe("AB12CD");
  });

  it("rechaza patente inválida", () => {
    expect(
      carQuotationFormSchema.safeParse({ ...base, patente: "??" }).success,
    ).toBe(false);
  });

  it("exige al menos una aseguradora", () => {
    expect(
      carQuotationFormSchema.safeParse({ ...base, insurerKeys: [] }).success,
    ).toBe(false);
  });

  it("acepta múltiples deducibles", () => {
    const r = carQuotationFormSchema.safeParse({
      ...base,
      deductibles: [0, 5, 10],
    });
    expect(r.success).toBe(true);
  });

  it("rechaza año fuera de rango", () => {
    expect(
      carQuotationFormSchema.safeParse({ ...base, anio: "1800" }).success,
    ).toBe(false);
  });
});
