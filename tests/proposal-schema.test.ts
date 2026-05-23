import { describe, it, expect } from "vitest";
import { proposalFormSchema } from "@/features/proposals/schemas";

const baseProposal = {
  clientId: "client-1",
  companyId: "",
  lineId: "",
  premiumNet: "",
  premiumGross: "",
  currency: "UF" as const,
  startDate: "",
  endDate: "",
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
