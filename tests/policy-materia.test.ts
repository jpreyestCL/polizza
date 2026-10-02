import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { policyMateriaFromItems } from "@/features/policies/draft-policy";

const target = { organizationId: "org", policyId: "pol", currency: "UF" };

function coverage(
  name: string,
  insuredAmount: number | null,
  extra: Partial<{
    sumsToTotal: boolean;
    deductibleText: string | null;
    deductibleAmount: number;
  }> = {},
) {
  return {
    name,
    insuredAmount: insuredAmount == null ? null : new Prisma.Decimal(insuredAmount),
    sumsToTotal: extra.sumsToTotal ?? true,
    deductibleText: extra.deductibleText ?? null,
    deductibleAmount:
      extra.deductibleAmount == null ? null : new Prisma.Decimal(extra.deductibleAmount),
    deductiblePct: null,
    deductibleMinimum: null,
  };
}

describe("ítems de la propuesta a la póliza", () => {
  it("usa identificación, luego patente, luego dirección, luego el ramo", () => {
    const { items } = policyMateriaFromItems(
      [
        { identification: "Flota 1", data: { patente: "AA11" }, branchType: { name: "Vehículos" }, coverages: [] },
        { identification: null, data: { patente: "BB22" }, branchType: { name: "Vehículos" }, coverages: [] },
        { identification: null, data: { direccion: "Calle 1" }, branchType: { name: "Hogar" }, coverages: [] },
        { identification: null, data: null, branchType: { name: "Vida" }, coverages: [] },
      ],
      target,
    );
    expect(items.map((item) => item.description)).toEqual([
      "Flota 1",
      "BB22",
      "Calle 1",
      "Vida",
    ]);
    expect(items.every((item) => item.policyId === "pol" && item.currency === "UF")).toBe(true);
  });

  it("el monto del ítem suma solo las coberturas que suman al total", () => {
    const { items, coverages } = policyMateriaFromItems(
      [
        {
          identification: "Auto",
          data: {},
          branchType: { name: "Vehículos" },
          coverages: [
            coverage("Daños", 650),
            coverage("RC", 1000, { sumsToTotal: false }),
          ],
        },
      ],
      target,
    );
    expect(Number(items[0].insuredAmount)).toBe(650);
    expect(coverages.map((c) => c.name)).toEqual(["Daños", "RC"]);
  });

  it("sin coberturas que sumen, el ítem queda sin monto", () => {
    const { items } = policyMateriaFromItems(
      [{ identification: "Casa", data: {}, branchType: { name: "Hogar" }, coverages: [] }],
      target,
    );
    expect(items[0].insuredAmount).toBeNull();
  });

  it("respeta el deducible estructurado y si no, lo lee del texto", () => {
    const { coverages } = policyMateriaFromItems(
      [
        {
          identification: "Auto",
          data: {},
          branchType: { name: "Vehículos" },
          coverages: [
            coverage("Daños", 650, { deductibleText: "UF 5", deductibleAmount: 5 }),
            coverage("Robo", 650, { deductibleText: "UF 3" }),
          ],
        },
      ],
      target,
    );
    expect(Number(coverages[0].deductibleAmount)).toBe(5);
    expect(coverages[1].deductible).toBeTruthy();
  });
});
