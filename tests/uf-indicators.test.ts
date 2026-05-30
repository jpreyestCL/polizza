import { describe, it, expect } from "vitest";
import { isValidRate, extractValidPoints } from "@/server/uf";

describe("isValidRate", () => {
  it("acepta números finitos mayores a 0", () => {
    expect(isValidRate(950.5)).toBe(true);
    expect(isValidRate(1)).toBe(true);
  });

  it("rechaza 0, negativos, NaN, Infinity y no-números", () => {
    expect(isValidRate(0)).toBe(false);
    expect(isValidRate(-1)).toBe(false);
    expect(isValidRate(Number.NaN)).toBe(false);
    expect(isValidRate(Infinity)).toBe(false);
    expect(isValidRate("950")).toBe(false);
    expect(isValidRate(null)).toBe(false);
    expect(isValidRate(undefined)).toBe(false);
  });
});

describe("extractValidPoints", () => {
  it("descarta puntos con valor 0 o inválido (fin de semana / festivo)", () => {
    const serie = [
      { fecha: "2026-05-29T04:00:00.000Z", valor: 945.1 }, // viernes
      { fecha: "2026-05-30T04:00:00.000Z", valor: 0 }, // sábado, sin dato
      { fecha: "2026-05-31T04:00:00.000Z", valor: 0 }, // domingo, sin dato
    ];
    const points = extractValidPoints(serie);
    expect(points).toHaveLength(1);
    expect(points[0].value).toBe(945.1);
    // La fecha se normaliza a UTC a medianoche.
    expect(points[0].date.toISOString().slice(0, 10)).toBe("2026-05-29");
  });

  it("ignora fechas no parseables", () => {
    const serie = [
      { fecha: "no-es-fecha", valor: 100 },
      { fecha: "2026-01-02T04:00:00.000Z", valor: 100 },
    ];
    expect(extractValidPoints(serie)).toHaveLength(1);
  });

  it("tolera serie vacía o indefinida", () => {
    expect(extractValidPoints([])).toEqual([]);
    expect(extractValidPoints(undefined)).toEqual([]);
  });
});
