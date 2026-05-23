import { describe, it, expect } from "vitest";
import { generatePlanSchema } from "@/features/billing/schemas";
import { isInstallmentOverdue } from "@/features/billing/overdue";

const basePlan = {
  count: "12",
  amount: "1.5",
  firstDueDate: "2026-06-01",
  currency: "UF" as const,
};

describe("generatePlanSchema", () => {
  it("acepta un plan de cuotas válido", () => {
    expect(generatePlanSchema.safeParse(basePlan).success).toBe(true);
  });

  it("rechaza un plan sin cuotas", () => {
    expect(
      generatePlanSchema.safeParse({ ...basePlan, count: "0" }).success,
    ).toBe(false);
  });

  it("rechaza más de 36 cuotas", () => {
    expect(
      generatePlanSchema.safeParse({ ...basePlan, count: "40" }).success,
    ).toBe(false);
  });

  it("rechaza un monto no positivo", () => {
    expect(
      generatePlanSchema.safeParse({ ...basePlan, amount: "0" }).success,
    ).toBe(false);
  });
});

describe("isInstallmentOverdue", () => {
  const past = new Date(Date.now() - 5 * 86_400_000);
  const future = new Date(Date.now() + 5 * 86_400_000);

  it("marca vencida una cuota pendiente con fecha pasada", () => {
    expect(isInstallmentOverdue("PENDIENTE", past)).toBe(true);
  });

  it("no marca vencida una cuota pagada", () => {
    expect(isInstallmentOverdue("PAGADA", past)).toBe(false);
  });

  it("no marca vencida una cuota con fecha futura", () => {
    expect(isInstallmentOverdue("PENDIENTE", future)).toBe(false);
  });
});
