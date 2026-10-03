import { describe, expect, it } from "vitest";
import {
  MASKED_DATE,
  maskAddress,
  maskEmail,
  maskPhone,
  normalizeClientEmail,
} from "@/features/clients/privacy";

describe("client privacy helpers", () => {
  it("normaliza correos para comparar y persistir", () => {
    expect(normalizeClientEmail("  Persona@Ejemplo.CL ")).toBe(
      "persona@ejemplo.cl",
    );
    expect(normalizeClientEmail("   ")).toBeNull();
  });

  it("enmascara los datos sensibles conservando contexto mínimo", () => {
    expect(maskEmail("persona@ejemplo.cl")).toBe("p***@ejemplo.cl");
    expect(maskPhone("+56 9 1234 5678")).toBe("•••• 5678");
    expect(maskAddress("Av. Siempre Viva 123")).toBe("••••••••");
    expect(MASKED_DATE).toBe("••/••/••••");
  });

  it("mantiene nulos para no simular datos inexistentes", () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskPhone(undefined)).toBeNull();
    expect(maskAddress("")).toBeNull();
  });
});
