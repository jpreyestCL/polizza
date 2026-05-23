import { describe, expect, it } from "vitest";
import { createSimulatedAdapter } from "@/features/car-quotes/insurers/simulated";
import type { QuotationInput } from "@/features/car-quotes/insurers/types";

const baseInput: QuotationInput = {
  patente: "AB1234",
  marca: "Toyota",
  modelo: "Yaris",
  anio: 2022,
  tipoVehiculo: "Sedán",
  motorizacion: "1.5",
  vehicleCondition: "USADO",
  vehicleUse: "PARTICULAR",
  civilLiabilityUf: 500,
  workshopType: "EXCLUSIVIDAD",
  deductiblesUf: [3, 5],
  client: { rut: "11.111.111-1", name: "Demo", birthDate: null },
};

describe("simulated insurer adapter", () => {
  it("genera un resultado determinista para el mismo input", async () => {
    const a = createSimulatedAdapter("bci", "BCI Seguros");
    const r1 = await a.quote(baseInput, null);
    const r2 = await a.quote(baseInput, null);
    expect(r1.premiumUf).toBe(r2.premiumUf);
    expect(r1.deductibleUf).toBe(r2.deductibleUf);
  });

  it("genera distinto resultado para aseguradoras distintas", async () => {
    const a = createSimulatedAdapter("bci", "BCI");
    const b = createSimulatedAdapter("zurich", "Zurich");
    const r1 = await a.quote(baseInput, null);
    const r2 = await b.quote(baseInput, null);
    expect(r1.premiumUf).not.toBe(r2.premiumUf);
  });

  it("respeta el set de deducibles", async () => {
    const a = createSimulatedAdapter("hdi", "HDI");
    const r = await a.quote(
      { ...baseInput, deductiblesUf: [10] },
      null,
    );
    expect(r.deductibleUf).toBe(10);
  });

  it("usa default cuando no se pasa deducible", async () => {
    const a = createSimulatedAdapter("sura", "Sura");
    const r = await a.quote({ ...baseInput, deductiblesUf: [] }, null);
    expect([0, 3, 5, 10, 15]).toContain(r.deductibleUf);
  });

  it("retorna un PDF no vacío", async () => {
    const a = createSimulatedAdapter("chubb", "Chubb");
    const r = await a.quote(baseInput, null);
    expect(r.pdf.byteLength).toBeGreaterThan(500);
    expect(r.pdf.slice(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("aplica recargo a vehículos nuevos y uso comercial", async () => {
    const a = createSimulatedAdapter("aspor", "Aspor");
    const usado = await a.quote(baseInput, null);
    const nuevoComercial = await a.quote(
      { ...baseInput, vehicleCondition: "NUEVO", vehicleUse: "COMERCIAL" },
      null,
    );
    expect(nuevoComercial.premiumUf).toBeGreaterThan(usado.premiumUf);
  });
});
