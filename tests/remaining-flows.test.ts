import { describe, expect, it } from "vitest";
import { reopenIssueBlockers, specStateOfProposal, canDiscardProposal } from "@/lib/domain/policy-lifecycle";
import { inalterabilityDecision, specEndorsementOf } from "@/lib/domain/endorsement-catalog";
import {
  cleanPhone,
  correctStoredFx,
  ghostInstallmentAction,
  maskAccount,
  mergeRutGroups,
  suggestNaturalPerson,
  unifyCurrency,
} from "@/lib/domain/brokeris-clean";
import { extractPolicyText } from "@/lib/domain/extraction";
import { secondFactorStep } from "@/lib/domain/access-gate";
import { reportTable, toCsv } from "@/lib/domain/report-csv";
import { adjustmentDeadlineDays } from "@/lib/domain/claim-workflows";
import { totpCode, totpMatches } from "@/server/totp";

describe("ciclo y endosos", () => {
  it("traduce la propuesta y bloquea la reapertura si hay un pago", () => {
    expect(specStateOfProposal("ENVIADA_COMPANIA")).toBe("SENT_TO_INSURER");
    expect(canDiscardProposal("ELABORACION")).toBe(true);
    expect(canDiscardProposal("POR_DESPACHAR")).toBe(false);
    expect(
      reopenIssueBlockers({
        issuedEndorsements: 0,
        appliedPayments: 1,
        commissionAllocations: 0,
        sentDispatches: 0,
      }),
    ).toHaveLength(1);
  });

  it("exige autorización del acreedor y deja pasar lo que la compañía ya emitió", () => {
    expect(specEndorsementOf("CANCELACION_COMPANIA").calcMethod).toBe("REFUND_PRORATA");
    expect(specEndorsementOf("PRORROGA").calcMethod).toBe("DAYS_FACTOR");
    const blocked = inalterabilityDecision({
      hasClause: true,
      specType: "CANCELLATION",
      lowersSumInsured: false,
      removesLossPayee: false,
      hasCreditorAuthorization: false,
      canOverride: false,
      overrideReason: null,
      recordingWhatInsurerIssued: false,
    });
    expect(blocked.blocked).toBe(true);
    expect(blocked.code).toBe("CREDITOR_REQUIRED");
    const recorded = inalterabilityDecision({
      hasClause: true,
      specType: "CANCELLATION",
      lowersSumInsured: false,
      removesLossPayee: false,
      hasCreditorAuthorization: false,
      canOverride: false,
      overrideReason: null,
      recordingWhatInsurerIssued: true,
    });
    expect(recorded.blocked).toBe(false);
    expect(recorded.warnCreditor).toBe(true);
  });
});

describe("limpieza Brokeris", () => {
  it("normaliza RUT, teléfono, dólar, tipo de cambio y cuotas fantasma", () => {
    const merges = mergeRutGroups([
      { id: "a", rut: "12.345.678-5", policyCount: 1 },
      { id: "b", rut: "123456785", policyCount: 3 },
    ]);
    expect(merges[0]?.keepId).toBe("b");
    expect(suggestNaturalPerson("12.345.678-5", "EMPRESA")).toBe(true);
    expect(cleanPhone("9 1234 5678").e164).toBe("+56912345678");
    expect(unifyCurrency("dólar")).toBe("USD");
    expect(correctStoredFx(4_000_000, 39_000).corrected).toBe(true);
    expect(maskAccount("1234567890123456")).toBe("3456");
    expect(
      ghostInstallmentAction({
        method: "PAC",
        policyEnded: false,
        daysOverdue: 90,
        choice: "B",
      }),
    ).toBe("PRESUMED_PAID");
    expect(
      ghostInstallmentAction({
        method: "AVISO_CUOTA",
        policyEnded: false,
        daysOverdue: 10,
        choice: "D",
      }),
    ).toBe("PENDING");
  });
});

describe("extracción, acceso e informes", () => {
  it("extrae el texto y deja en revisión si falta la prima", () => {
    const full = extractPolicyText(
      "Póliza N° ABC-123 Prima neta 15,5 Desde 01-03-2026 Hasta 01-03-2027",
    );
    expect(full.status).toBe("EXTRACTED");
    expect(full.policyNumber).toBe("ABC-123");
    expect(full.premiumNet).toBe(15.5);
    const partial = extractPolicyText("Póliza N° ABC-123 sin montos");
    expect(partial.status).toBe("NEEDS_REVIEW");
  });

  it("pide el segundo factor solo si la corredora lo exige", () => {
    expect(secondFactorStep({ mfaRequired: false, enrolled: false })).toBe("app");
    expect(secondFactorStep({ mfaRequired: true, enrolled: false })).toBe("enroll");
    expect(secondFactorStep({ mfaRequired: true, enrolled: true })).toBe("totp");
  });

  it("verifica un código TOTP de la misma clave", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const code = totpCode(secret, Date.UTC(2026, 0, 1));
    expect(totpMatches(secret, code, Date.UTC(2026, 0, 1))).toBe(true);
    expect(totpMatches(secret, "000000", Date.UTC(2026, 0, 1))).toBe(false);
  });

  it("arma el CSV de producción y el plazo de liquidación", () => {
    const table = reportTable("R-01", {
      portfolioCount: 2,
      retentionRate: "0.5",
      production: [
        { currency: "UF", movementType: "ISSUE", count: 1, net: 10, gross: 11.9, commission: 1 },
      ],
      aging: [],
      claimsOpen: 0,
      catalogValue: "",
    });
    expect(toCsv(table!).split("\n")).toHaveLength(2);
    expect(adjustmentDeadlineDays("VEHICLE")).toBe(30);
    expect(adjustmentDeadlineDays("PROPERTY")).toBe(130);
  });
});
