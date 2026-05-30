import { describe, it, expect } from "vitest";
import { proposalFormSchema } from "@/features/proposals/schemas";

// Campos obligatorios del punto 2 (doc "Observaciones módulo propuestas").
const baseProposal = {
  clientId: "client-1",
  insuredClientId: "client-1",
  beneficiaryClientId: "client-1",
  insuranceCompanyId: "co-1",
  branchTypeId: "bt-1",
  productId: "p-1",
  lineId: "",
  premiumNet: "",
  premiumGross: "",
  currency: "UF" as const,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  recipientEmail: "destino@cia.cl",
  commissionAffectPct: "16",
  commissionExemptPct: "9",
  assignedUserId: "",
};

describe("proposalFormSchema", () => {
  it("acepta una propuesta válida", () => {
    expect(proposalFormSchema.safeParse(baseProposal).success).toBe(true);
  });

  it("exige un cliente", () => {
    expect(
      proposalFormSchema.safeParse({ ...baseProposal, clientId: "" }).success,
    ).toBe(false);
  });

  it("rechaza una prima negativa", () => {
    expect(
      proposalFormSchema.safeParse({ ...baseProposal, premiumNet: "-100" })
        .success,
    ).toBe(false);
  });

  it("acepta una prima con monto", () => {
    expect(
      proposalFormSchema.safeParse({ ...baseProposal, premiumNet: "150.5" })
        .success,
    ).toBe(true);
  });
});
