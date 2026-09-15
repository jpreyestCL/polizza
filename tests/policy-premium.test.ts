import { describe, it, expect } from "vitest";
import { computeGross } from "@/features/policies/premium";

describe("computeGross — el IVA se calcula sobre la prima afecta", () => {
  it("usa el desglose de la póliza importada: 9,12 afecta + 44,12 exenta = 54,97", () => {
    // Caso real: póliza de incendio 20622380 (Liberty). Antes devolvía 63,36
    // porque aplicaba 19% sobre la prima neta total (53,24).
    const gross = computeGross(53.24, null, {
      premiumAffect: 9.12,
      premiumExempt: 44.12,
    });
    expect(gross).toBeCloseTo(54.97, 2);
  });

  it("no cambia el resultado cuando toda la prima es afecta", () => {
    expect(
      computeGross(18.76, null, { premiumAffect: 18.76, premiumExempt: 0 }),
    ).toBeCloseTo(22.32, 2);
  });

  it("no aplica IVA cuando toda la prima es exenta", () => {
    expect(
      computeGross(44.12, null, { premiumAffect: 0, premiumExempt: 44.12 }),
    ).toBeCloseTo(44.12, 2);
  });

  it("prefiere el desglose de la propuesta por sobre el de la póliza", () => {
    const proposal = {
      items: [{ coverages: [{ premiumAffect: 100, premiumExempt: 0 }] }],
    };
    expect(
      computeGross(100, proposal, { premiumAffect: 1, premiumExempt: 1 }),
    ).toBeCloseTo(119, 2);
  });

  it("cae a neta × 1.19 solo cuando no hay desglose por ninguna vía", () => {
    expect(computeGross(100, null, null)).toBeCloseTo(119, 2);
    expect(
      computeGross(100, null, { premiumAffect: null, premiumExempt: null }),
    ).toBeCloseTo(119, 2);
  });

  it("devuelve null si no hay prima neta", () => {
    expect(computeGross(null, null, null)).toBeNull();
  });
});
