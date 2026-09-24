import { describe, it, expect } from "vitest";
import {
  evaluateCompanyPayment,
  isPaidByCompany,
  COMMISSION_TOLERANCE_PCT,
} from "@/lib/commissions";
import { parseLocaleNumber } from "@/lib/money";
import { companyPaymentSchema } from "@/features/commissions/schemas";

describe("isPaidByCompany con decisión de la revisión", () => {
  it("la decisión 'pagada' manda aunque falte una diferencia menor", () => {
    expect(isPaidByCompany(2.01, 2.009, true)).toBe(true);
  });

  it("la decisión 'pendiente' manda aunque la suma cubra la comisión", () => {
    expect(isPaidByCompany(2.01, 2.5, false)).toBe(false);
  });

  it("sin decisión vuelve al cálculo automático por suma de pagos", () => {
    expect(isPaidByCompany(2.01, 2.01, null)).toBe(true);
    expect(isPaidByCompany(2.01, 1.5, undefined)).toBe(false);
  });
});

describe("evaluateCompanyPayment", () => {
  // Caso de la captura de Brokeris: 2,01 UF × 40.950,75 = $82.311; la
  // compañía pagó $82.274.
  it("con tipo de cambio informado calcula lo esperado y la diferencia", () => {
    const ev = evaluateCompanyPayment({
      due: 2.01,
      paidAmount: 82274,
      enteredRate: 40950.75,
    });
    expect(ev.rateSource).toBe("entered");
    expect(ev.expectedAmount).toBe(82311.01);
    expect(ev.difference).toBe(-37.01);
    expect(ev.verdict).toBe("ok");
  });

  it("sin tipo de cambio entrega el que usó la compañía", () => {
    const ev = evaluateCompanyPayment({
      due: 2.01,
      paidAmount: 82274,
      referenceRate: 40992,
    });
    expect(ev.rateSource).toBe("reference");
    expect(ev.impliedRate).toBeCloseTo(40932.34, 2);
    expect(ev.verdict).toBe("ok");
  });

  it("marca un pago de menos fuera del margen", () => {
    const ev = evaluateCompanyPayment({
      due: 2.01,
      paidAmount: 70000,
      enteredRate: 40950.75,
    });
    expect(ev.verdict).toBe("under");
    expect(ev.differencePct).toBeLessThan(-COMMISSION_TOLERANCE_PCT);
    // El pago convertido deja saldo pendiente en UF.
    expect(ev.paidInPolicyCurrency).toBeCloseTo(1.7094, 3);
  });

  it("marca un pago de más fuera del margen", () => {
    const ev = evaluateCompanyPayment({
      due: 2.01,
      paidAmount: 90000,
      enteredRate: 40950.75,
    });
    expect(ev.verdict).toBe("over");
  });

  it("sin referencia usa el implícito y no puede detectar diferencia", () => {
    const ev = evaluateCompanyPayment({ due: 2, paidAmount: 80000 });
    expect(ev.rateSource).toBe("implied");
    expect(ev.rateUsed).toBe(40000);
    expect(ev.difference).toBe(0);
  });

  it("pago en la misma moneda de la póliza no convierte", () => {
    const ev = evaluateCompanyPayment({
      due: 100,
      paidAmount: 100.5,
      sameCurrency: true,
    });
    expect(ev.rateSource).toBe("same");
    expect(ev.impliedRate).toBeNull();
    expect(ev.verdict).toBe("ok");
  });

  it("sin monto pagado solo informa lo esperado", () => {
    const ev = evaluateCompanyPayment({
      due: 2.01,
      paidAmount: null,
      enteredRate: 40000,
    });
    expect(ev.expectedAmount).toBe(80400);
    expect(ev.verdict).toBeNull();
  });
});

describe("parseLocaleNumber", () => {
  it("interpreta el punto como separador de miles", () => {
    expect(parseLocaleNumber("82.274")).toBe(82274);
    expect(parseLocaleNumber("$1.234.567")).toBe(1234567);
  });

  it("interpreta la coma decimal", () => {
    expect(parseLocaleNumber("40.950,75")).toBe(40950.75);
    expect(parseLocaleNumber("2,01")).toBe(2.01);
  });

  it("acepta punto decimal", () => {
    expect(parseLocaleNumber("40950.75")).toBe(40950.75);
    expect(parseLocaleNumber("2.01")).toBe(2.01);
  });

  it("devuelve null en vacío o texto", () => {
    expect(parseLocaleNumber("")).toBeNull();
    expect(parseLocaleNumber("abc")).toBeNull();
  });
});

describe("companyPaymentSchema", () => {
  const base = {
    policyId: "p1",
    paymentDate: "2026-09-24",
    amount: "82274",
    currency: "CLP",
    invoiceNumber: "",
    invoiceDate: "",
    exchangeFactor: "40950.75",
    notes: "",
  };

  it("por defecto deja la comisión pagada", () => {
    const res = companyPaymentSchema.parse(base);
    expect(res.decision).toBe("PAID");
  });

  it("acepta dejar la comisión pendiente", () => {
    const res = companyPaymentSchema.parse({ ...base, decision: "PENDING" });
    expect(res.decision).toBe("PENDING");
  });

  it("rechaza un tipo de cambio no positivo", () => {
    expect(
      companyPaymentSchema.safeParse({ ...base, exchangeFactor: "0" }).success,
    ).toBe(false);
  });
});
