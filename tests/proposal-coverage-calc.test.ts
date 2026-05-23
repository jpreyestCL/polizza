import { describe, expect, it } from "vitest";
import { computeCoverage } from "@/features/proposal-coverages/schemas";

const base = {
  order: "0",
  name: "Test",
  polCad: "",
  type: "COBERTURA" as const,
  isCommercialValue: false,
  insuredCurrency: "UF",
  sumsToTotal: true,
};

describe("computeCoverage", () => {
  it("calcula prima neta vía tasa en por mil", () => {
    const calc = computeCoverage({
      ...base,
      insuredAmount: "1000",
      affectedByIva: false,
      taxRateAffect: "5",
      taxRateExempt: "0",
      premiumAffect: "",
      premiumExempt: "",
      commissionAffectPct: "",
      commissionExemptPct: "",
      manualPremium: false,
    });
    expect(calc.premiumNet).toBeCloseTo(5);
    expect(calc.ivaAmount).toBe(0);
    expect(calc.premiumGross).toBeCloseTo(5);
  });

  it("aplica IVA 19% solo sobre la parte afecta", () => {
    const calc = computeCoverage({
      ...base,
      insuredAmount: "1000",
      affectedByIva: true,
      taxRateAffect: "10",
      taxRateExempt: "2",
      premiumAffect: "",
      premiumExempt: "",
      commissionAffectPct: "",
      commissionExemptPct: "",
      manualPremium: false,
    });
    expect(calc.premiumNet).toBeCloseTo(12); // 10 + 2
    expect(calc.ivaAmount).toBeCloseTo(1.9); // 10 * 0.19
    expect(calc.premiumGross).toBeCloseTo(13.9);
  });

  it("usa los montos directamente si manualPremium=true", () => {
    const calc = computeCoverage({
      ...base,
      insuredAmount: "1000",
      affectedByIva: true,
      taxRateAffect: "99",
      taxRateExempt: "99",
      premiumAffect: "100",
      premiumExempt: "50",
      commissionAffectPct: "",
      commissionExemptPct: "",
      manualPremium: true,
    });
    expect(calc.premiumNet).toBeCloseTo(150);
    expect(calc.ivaAmount).toBeCloseTo(19);
    expect(calc.premiumGross).toBeCloseTo(169);
  });

  it("calcula comisión por separado afecta/exenta", () => {
    const calc = computeCoverage({
      ...base,
      insuredAmount: "1000",
      affectedByIva: false,
      taxRateAffect: "10",
      taxRateExempt: "0",
      premiumAffect: "",
      premiumExempt: "",
      commissionAffectPct: "15",
      commissionExemptPct: "0",
      manualPremium: false,
    });
    // premiumAffect = 1000 * 10/1000 = 10
    expect(calc.commissionAmount).toBeCloseTo(10 * 0.15);
  });
});
