import { describe, it, expect } from "vitest";
import { ufToClp, formatClp, clpEquivalent } from "@/lib/uf";

describe("ufToClp", () => {
  it("convierte UF a pesos redondeando al peso", () => {
    expect(ufToClp(10, 39283.45)).toBe(392835);
  });

  it("convierte montos fraccionarios de UF", () => {
    expect(ufToClp(1.5, 40000)).toBe(60000);
  });
});

describe("formatClp", () => {
  it("formatea pesos con separador de miles chileno", () => {
    expect(formatClp(1234567)).toBe("$1.234.567");
  });

  it("redondea decimales", () => {
    expect(formatClp(999.6)).toBe("$1.000");
  });
});

describe("clpEquivalent", () => {
  it("devuelve el equivalente en pesos para montos en UF", () => {
    expect(clpEquivalent(10, "UF", 39000)).toBe("$390.000");
  });

  it("devuelve null para monedas distintas de UF", () => {
    expect(clpEquivalent(10, "CLP", 39000)).toBeNull();
  });

  it("devuelve null cuando no hay valor de UF disponible", () => {
    expect(clpEquivalent(10, "UF", null)).toBeNull();
  });
});
