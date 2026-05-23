import { describe, it, expect } from "vitest";
import {
  proposalFormSchema,
  proposalDraftSchema,
} from "@/features/proposals/schemas";

const base = {
  clientId: "c1",
  insuranceCompanyId: "co1",
  branchTypeId: "bt1",
  productId: "p1",
  currency: "UF" as const,
};

describe("proposalFormSchema — participaciones", () => {
  it("acepta coaseguro con participaciones que suman 100", () => {
    const r = proposalFormSchema.safeParse({
      ...base,
      coaseguro: true,
      coaseguroParticipations: [
        { insuranceCompanyId: "x", participationPct: "60", policyNumber: "" },
        { insuranceCompanyId: "y", participationPct: "40", policyNumber: "" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rechaza coaseguro con participaciones que NO suman 100", () => {
    const r = proposalFormSchema.safeParse({
      ...base,
      coaseguro: true,
      coaseguroParticipations: [
        { insuranceCompanyId: "x", participationPct: "60", policyNumber: "" },
        { insuranceCompanyId: "y", participationPct: "30", policyNumber: "" },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("acepta co-corredor con brokers que suman 100", () => {
    const r = proposalFormSchema.safeParse({
      ...base,
      coCorredor: true,
      brokerParticipations: [
        { brokerId: "b1", participationPct: "50" },
        { brokerId: "b2", participationPct: "50" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rechaza co-corredor con brokers que NO suman 100", () => {
    const r = proposalFormSchema.safeParse({
      ...base,
      coCorredor: true,
      brokerParticipations: [
        { brokerId: "b1", participationPct: "70" },
        { brokerId: "b2", participationPct: "20" },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("acepta participaciones vacías cuando la casilla está desactivada", () => {
    const r = proposalFormSchema.safeParse({
      ...base,
      coaseguro: false,
      coCorredor: false,
    });
    expect(r.success).toBe(true);
  });
});

describe("proposalDraftSchema", () => {
  it("acepta el mínimo: cliente + compañía + ramo", () => {
    const r = proposalDraftSchema.safeParse({
      clientId: "c1",
      insuranceCompanyId: "co1",
      branchTypeId: "bt1",
      lineId: "",
      branchId: "",
    });
    expect(r.success).toBe(true);
  });

  it("acepta el mínimo legacy: cliente + compañía + línea+ramo legacy", () => {
    const r = proposalDraftSchema.safeParse({
      clientId: "c1",
      insuranceCompanyId: "co1",
      branchTypeId: "",
      lineId: "l1",
      branchId: "b1",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza sin cliente", () => {
    const r = proposalDraftSchema.safeParse({
      clientId: "",
      insuranceCompanyId: "co1",
      branchTypeId: "bt1",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza sin compañía", () => {
    const r = proposalDraftSchema.safeParse({
      clientId: "c1",
      insuranceCompanyId: "",
      branchTypeId: "bt1",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza sin ramo ni línea+ramo legacy", () => {
    const r = proposalDraftSchema.safeParse({
      clientId: "c1",
      insuranceCompanyId: "co1",
      branchTypeId: "",
      lineId: "",
      branchId: "",
    });
    expect(r.success).toBe(false);
  });
});
