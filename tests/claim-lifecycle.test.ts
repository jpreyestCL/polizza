import { describe, expect, it } from "vitest";
import {
  adjustmentLegalDeadline,
  canReopenClaim,
  canVoidClaim,
  claimTransitionError,
  closeDeadline,
  closureOutcomeError,
  disputeDeadline,
  isClaimOpen,
  substatusError,
} from "@/lib/domain/claim-lifecycle";

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("ciclo del siniestro", () => {
  it("solo deja los pasos de la especificación", () => {
    expect(claimTransitionError("REPORTED", "AWAITING_ASSIGNMENT")).toBeNull();
    expect(claimTransitionError("REPORTED", "CLOSED")).toMatch(/INVALID_TRANSITION/);
    expect(claimTransitionError("IN_ADJUSTMENT", "PAYMENT_PROCESS")).toBeNull();
    expect(claimTransitionError("PAYMENT_PROCESS", "CLOSED")).toBeNull();
    expect(claimTransitionError("CLOSED", "IN_ADJUSTMENT")).toMatch(/INVALID_TRANSITION/);
    expect(canVoidClaim("REPORTED")).toBe(true);
    expect(canVoidClaim("IN_ADJUSTMENT")).toBe(false);
    expect(canReopenClaim("CLOSED")).toBe(true);
    expect(canReopenClaim("VOID")).toBe(false);
    expect(isClaimOpen("PAYMENT_PROCESS")).toBe(true);
    expect(isClaimOpen("VOID")).toBe(false);
  });

  it("el cierre sin pago no acepta pagado, y el proceso de pago sí", () => {
    expect(closureOutcomeError("IN_ADJUSTMENT", "REJECTED")).toBeNull();
    expect(closureOutcomeError("IN_ADJUSTMENT", "PAID")).toMatch(/INVALID_TRANSITION/);
    expect(closureOutcomeError("PAYMENT_PROCESS", "PAID")).toBeNull();
    expect(closureOutcomeError("PAYMENT_PROCESS", "REPAIRED")).toBeNull();
    expect(substatusError("IN_ADJUSTMENT", "DISPUTED")).toBeNull();
    expect(substatusError("REPORTED", "IN_REPAIR")).toMatch(/subestado/);
  });

  it("calcula los plazos del ejemplo de la especificación", () => {
    expect(closeDeadline(day("2026-09-10")).toISOString().slice(0, 10)).toBe("2026-11-09");
    expect(adjustmentLegalDeadline(day("2026-09-01")).toISOString().slice(0, 10)).toBe(
      "2026-10-16",
    );
    expect(
      adjustmentLegalDeadline(day("2026-09-01"), { annualPremiumUf: 120 })
        .toISOString()
        .slice(0, 10),
    ).toBe("2026-11-30");
    expect(
      adjustmentLegalDeadline(day("2026-09-01"), { hull: true }).toISOString().slice(0, 10),
    ).toBe("2027-02-28");
    expect(disputeDeadline(day("2026-10-15")).toISOString().slice(0, 10)).toBe("2026-10-29");
  });
});
