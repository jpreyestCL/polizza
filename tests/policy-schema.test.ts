import { describe, it, expect } from "vitest";
import { policyFormSchema } from "@/features/policies/schemas";

const basePolicy = {
  clientId: "client-1",
  proposalId: "",
  policyNumber: "POL-001",
  companyId: "",
  lineId: "",
  premiumNet: "",
  currency: "UF" as const,
  startDate: "",
  endDate: "",
  assignedUserId: "",
  items: [],
  coverages: [],
};

describe("policyFormSchema", () => {
  it("acepta una póliza válida", () => {
    expect(policyFormSchema.safeParse(basePolicy).success).toBe(true);
  });

  it("exige número de póliza", () => {
    expect(
      policyFormSchema.safeParse({ ...basePolicy, policyNumber: "" }).success,
    ).toBe(false);
  });

  it("exige un cliente", () => {
    expect(
      policyFormSchema.safeParse({ ...basePolicy, clientId: "" }).success,
    ).toBe(false);
  });

  it("rechaza un bien asegurado sin descripción", () => {
    expect(
      policyFormSchema.safeParse({
        ...basePolicy,
        items: [{ description: "", insuredAmount: "" }],
      }).success,
    ).toBe(false);
  });

  it("acepta items y coberturas válidos", () => {
    const result = policyFormSchema.safeParse({
      ...basePolicy,
      items: [{ description: "Camión Volvo FH16", insuredAmount: "1200" }],
      coverages: [
        { name: "Daños propios", deductible: "10 UF", insuredAmount: "" },
      ],
    });
    expect(result.success).toBe(true);
  });
});
