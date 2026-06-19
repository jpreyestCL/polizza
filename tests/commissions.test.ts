import { describe, it, expect } from "vitest";
import {
  brokerCommissionOf,
  appliedSellerPct,
  sellerPayout,
  totalCompanyPaid,
  paymentInPolicyCurrency,
  isPaidByCompany,
} from "@/lib/commissions";

describe("brokerCommissionOf", () => {
  it("usa commissionAmount cuando está definido", () => {
    expect(
      brokerCommissionOf({ commissionAmount: 126844, premiumNet: 34.83 }),
    ).toBe(126844);
  });

  it("deriva de prima × % cuando no hay monto", () => {
    expect(
      brokerCommissionOf({ premiumNet: 1000, commissionPercent: 12 }),
    ).toBe(120);
  });

  it("devuelve 0 sin datos suficientes", () => {
    expect(brokerCommissionOf({ premiumNet: 1000 })).toBe(0);
    expect(brokerCommissionOf({})).toBe(0);
  });
});

describe("appliedSellerPct", () => {
  it("prefiere el override de la póliza", () => {
    expect(appliedSellerPct(10, 20)).toBe(10);
  });

  it("respeta un override de 0 (acuerdo para cerrar deal)", () => {
    expect(appliedSellerPct(0, 20)).toBe(0);
  });

  it("cae a la tasa default del vendedor", () => {
    expect(appliedSellerPct(null, 20)).toBe(20);
    expect(appliedSellerPct(undefined, 20)).toBe(20);
  });

  it("devuelve null si no hay ninguna", () => {
    expect(appliedSellerPct(null, null)).toBeNull();
  });
});

describe("sellerPayout", () => {
  it("calcula % sobre la comisión corredora", () => {
    expect(sellerPayout(100000, 20)).toBe(20000);
  });

  it("es 0 sin tasa aplicable", () => {
    expect(sellerPayout(100000, null)).toBe(0);
  });

  it("redondea a 2 decimales", () => {
    expect(sellerPayout(333.33, 33.333)).toBe(111.11);
  });
});

describe("isPaidByCompany", () => {
  it("true cuando los pagos cubren la comisión", () => {
    expect(isPaidByCompany(100000, 100000)).toBe(true);
    expect(isPaidByCompany(100000, 150000)).toBe(true);
  });

  it("false con pago parcial", () => {
    expect(isPaidByCompany(100000, 60000)).toBe(false);
  });

  it("false cuando la comisión corredora es 0", () => {
    expect(isPaidByCompany(0, 0)).toBe(false);
  });

  it("tolera diferencias de redondeo de 1 centavo", () => {
    expect(isPaidByCompany(100, 99.99)).toBe(true);
  });
});

describe("paymentInPolicyCurrency", () => {
  it("misma moneda: monto tal cual", () => {
    expect(
      paymentInPolicyCurrency({ amount: 100, currency: "UF" }, "UF"),
    ).toBe(100);
  });

  it("pago en CLP, póliza en UF: divide por el factor (valor UF)", () => {
    expect(
      paymentInPolicyCurrency(
        { amount: 152000, currency: "CLP", exchangeFactor: 38000 },
        "UF",
      ),
    ).toBe(4);
  });

  it("monedas distintas sin factor: no convierte (0, evita falso pagado)", () => {
    expect(
      paymentInPolicyCurrency({ amount: 152000, currency: "CLP" }, "UF"),
    ).toBe(0);
  });
});

describe("totalCompanyPaid", () => {
  it("suma pagos parciales en la moneda de la póliza", () => {
    expect(
      totalCompanyPaid(
        [
          { amount: 50000, currency: "CLP" },
          { amount: 30000, currency: "CLP" },
          { amount: 20000, currency: "CLP" },
        ],
        "CLP",
      ),
    ).toBe(100000);
  });

  it("convierte pagos en CLP contra una póliza en UF", () => {
    expect(
      totalCompanyPaid(
        [
          { amount: 38000, currency: "CLP", exchangeFactor: 38000 },
          { amount: 76000, currency: "CLP", exchangeFactor: 38000 },
        ],
        "UF",
      ),
    ).toBe(3);
  });

  it("0 sin pagos", () => {
    expect(totalCompanyPaid([], "UF")).toBe(0);
  });
});
