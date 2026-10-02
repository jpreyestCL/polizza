import { describe, expect, it } from "vitest";
import { classifyInstallmentsForTermination } from "@/lib/domain/installment-close";
import { issuePartsFromStored } from "@/lib/domain/issue-parts";
import { terminationResult } from "@/lib/domain/termination";
import { addBusinessDays } from "@/lib/working-days";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("cierre de cuotas al cancelar", () => {
  it("cobra pagada y presunta, resta la castigada y anula el impago", () => {
    const plan = classifyInstallmentsForTermination([
      { id: "paid", status: "PAGADA", amount: 5.02 },
      { id: "presumed", status: "PRESUNTA", amount: 5.02 },
      { id: "off", status: "CASTIGADA", amount: 5.02 },
      { id: "open", status: "PENDIENTE", amount: 5.02 },
      { id: "rejected", status: "RECHAZADA", amount: 5.05 },
      { id: "partial", status: "PARCIAL", amount: 5.02, amountPaid: 2 },
      { id: "void", status: "ANULADA", amount: 5.02 },
    ]);
    expect(plan.paid).toBeCloseTo(5.02 + 5.02 + 2, 4);
    expect(plan.writtenOff).toBeCloseTo(5.02, 4);
    expect(plan.cancelIds.sort()).toEqual(["open", "partial", "rejected"]);
  });

  it("el saldo resta lo pagado y lo castigado de la prima que queda", () => {
    const plan = classifyInstallmentsForTermination([
      { id: "paid", status: "PAGADA", amount: 10 },
      { id: "off", status: "CASTIGADA", amount: 5 },
    ]);
    const result = terminationResult({
      kind: "CANCELLATION",
      premium: { affected: 17, exempt: 30 },
      termStart: day("2026-01-01"),
      termEnd: day("2027-01-01"),
      effectiveDate: day("2026-10-01"),
      paid: plan.paid,
      writtenOff: plan.writtenOff,
    });
    expect(result.creditAffected).toBeCloseTo(-4.2849, 4);
    expect(result.creditExempt).toBeCloseTo(-7.5616, 4);
    expect(result.balance).toBeCloseTo(result.remainingGross - 10 - 5, 4);
  });
});

describe("movimiento de emisión desde la prima guardada", () => {
  it("usa la neta cuando el desglose está en cero", () => {
    expect(
      issuePartsFromStored({ affected: 0, exempt: 0, net: 50.23 }),
    ).toEqual({ affected: 50.23, exempt: 0 });
  });

  it("respeta afecta y exenta cuando existen", () => {
    expect(
      issuePartsFromStored({ affected: 17, exempt: 30, net: 47 }),
    ).toEqual({ affected: 17, exempt: 30 });
  });

  it("no crea movimiento si no hay prima", () => {
    expect(issuePartsFromStored({ affected: null, exempt: null, net: 0 })).toBe(
      null,
    );
  });
});

describe("plazo del endoso de corrección", () => {
  it("cuenta 10 días hábiles desde un viernes", () => {
    const due = addBusinessDays(day("2026-10-02"), 10, new Set());
    expect(due.toISOString().slice(0, 10)).toBe("2026-10-16");
  });
});
