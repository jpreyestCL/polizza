import { describe, it, expect } from "vitest";
import {
  isValidRut,
  computeDv,
  formatRut,
  cleanRut,
  normalizeRut,
} from "@/lib/rut";

describe("RUT chileno", () => {
  it("valida RUTs correctos", () => {
    expect(isValidRut("11.111.111-1")).toBe(true);
    expect(isValidRut("12.345.678-5")).toBe(true);
    expect(isValidRut("12345678-5")).toBe(true);
  });

  it("rechaza RUTs incorrectos", () => {
    expect(isValidRut("11.111.111-2")).toBe(false);
    expect(isValidRut("12.345.678-9")).toBe(false);
    expect(isValidRut("")).toBe(false);
    expect(isValidRut("abc")).toBe(false);
  });

  it("calcula el dígito verificador", () => {
    expect(computeDv("11111111")).toBe("1");
    expect(computeDv("12345678")).toBe("5");
  });

  it("limpia, formatea y normaliza", () => {
    expect(cleanRut("12.345.678-5")).toBe("123456785");
    expect(formatRut("123456785")).toBe("12.345.678-5");
    expect(normalizeRut("12.345.678-5")).toBe("12345678-5");
  });
});
