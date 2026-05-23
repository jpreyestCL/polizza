import { describe, it, expect } from "vitest";
import { claimFormSchema } from "@/features/claims/schemas";

const baseClaim = {
  clientId: "client-1",
  policyId: "",
  description: "Choque en estacionamiento, daño en parachoques trasero",
  occurredAt: "",
  reportedAt: "",
  estimatedAmount: "",
  settledAmount: "",
  currency: "UF" as const,
  assignedUserId: "",
};

describe("claimFormSchema", () => {
  it("acepta un siniestro válido", () => {
    expect(claimFormSchema.safeParse(baseClaim).success).toBe(true);
  });

  it("exige un cliente", () => {
    expect(
      claimFormSchema.safeParse({ ...baseClaim, clientId: "" }).success,
    ).toBe(false);
  });

  it("exige una descripción", () => {
    expect(
      claimFormSchema.safeParse({ ...baseClaim, description: "" }).success,
    ).toBe(false);
  });

  it("rechaza un monto negativo", () => {
    expect(
      claimFormSchema.safeParse({ ...baseClaim, estimatedAmount: "-5" })
        .success,
    ).toBe(false);
  });
});
