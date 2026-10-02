import { describe, expect, it } from "vitest";
import { mergeInsurersByRut } from "@/lib/domain/brokeris-clean";
import { assignRenewalLineage } from "@/lib/domain/brokeris-chain";
import {
  BROKERIS_LOAD_ORDER,
  evaluateBrokerisCuadre,
  referenceCuadreInput,
} from "@/lib/domain/brokeris-cuadre";
import {
  brokerisClaimClosureIds,
  brokerisEndorsementIds,
  brokerisNonRenewalReasonIds,
  mapBrokerisClaimClosure,
  mapBrokerisClaimSubstatus,
  mapBrokerisDispatchStatus,
  mapBrokerisDispatchType,
  mapBrokerisDocumentType,
  mapBrokerisEndorsement,
  mapBrokerisEndorsementType,
  mapBrokerisMovementKind,
  mapBrokerisNonRenewalReason,
  mapBrokerisNonRenewalType,
  mapBrokerisPaymentFrequency,
  mapBrokerisPaymentMethod,
  mapBrokerisProfile,
} from "@/lib/domain/brokeris-map";
import { translateBrokerisPaste } from "@/lib/domain/brokeris-translate";

const ENDORSEMENTS: [number, string, string][] = [
  [1, "ADD_ITEM", "CLIENT"],
  [19, "ADD_ITEM", "CLIENT"],
  [2, "REMOVE_ITEM", "CLIENT"],
  [29, "REMOVE_ITEM", "INSURER"],
  [30, "REPLACE_ITEMS", "CLIENT"],
  [12, "MODIFY_SUM_INSURED_PREMIUM", "CLIENT"],
  [5, "MODIFY_SUM_INSURED_PREMIUM", "CLIENT"],
  [10, "MODIFY_DATA", "CLIENT"],
  [20, "MODIFY_DATA", "CLIENT"],
  [21, "MODIFY_DATA", "CLIENT"],
  [13, "MODIFY_DATA", "BROKER"],
  [9, "CHANGE_PARTY", "CLIENT"],
  [33, "CHANGE_PARTY", "CLIENT"],
  [18, "EXTENSION", "CLIENT"],
  [38, "EXTENSION", "CLIENT"],
  [37, "EXTENSION_REVERSAL", "CLIENT"],
  [40, "REDUCE_TERM", "CLIENT"],
  [11, "CANCELLATION", "CLIENT"],
  [4, "CANCELLATION", "INSURER"],
  [39, "CANCELLATION", "NON_PAYMENT"],
  [32, "TOTAL_LOSS_TERMINATION", "INSURER"],
  [16, "ANNULMENT", "CLIENT"],
  [6, "ANNULMENT", "INSURER"],
  [3, "REINSTATEMENT", "CLIENT"],
  [7, "REINSTATEMENT", "INSURER"],
  [26, "COMMISSION_CHANGE", "BROKER"],
  [41, "BROKER_CHANGE", "CLIENT"],
  [15, "DECLARATION", "CLIENT"],
  [34, "DECLARATION", "CLIENT"],
  [27, "DECLARATION", "INSURER"],
  [28, "DECLARATION", "INSURER"],
  [23, "PREMIUM_ADJUSTMENT", "INSURER"],
  [24, "PREMIUM_ADJUSTMENT", "INSURER"],
  [17, "OTHER", "CLIENT"],
  [25, "OTHER", "BROKER"],
];

describe("mapa Brokeris", () => {
  it("traduce los 35 tipos de endoso y deja el 0 como emisión", () => {
    expect(ENDORSEMENTS).toHaveLength(35);
    expect(new Set(brokerisEndorsementIds())).toEqual(new Set(ENDORSEMENTS.map((row) => row[0])));
    for (const [id, code, initiatedBy] of ENDORSEMENTS) {
      expect(mapBrokerisEndorsementType(id)).toBe(code);
      expect(mapBrokerisEndorsement(id)).toMatchObject({ code, initiatedBy });
    }
    expect(mapBrokerisEndorsement(11)).toMatchObject({
      code: "CANCELLATION",
      initiatedBy: "CLIENT",
      calcMethod: "REFUND_PRORATA",
      mvpEnabled: true,
    });
    expect(mapBrokerisEndorsement(40)).toMatchObject({
      code: "REDUCE_TERM",
      calcMethod: "MANUAL",
      mvpEnabled: false,
    });
    expect(mapBrokerisEndorsement(37)?.code).toBe("EXTENSION_REVERSAL");
    expect(mapBrokerisEndorsement(23)?.code).toBe("PREMIUM_ADJUSTMENT");
    expect(mapBrokerisEndorsement(28)).toMatchObject({
      code: "DECLARATION",
      initiatedBy: "INSURER",
      calcMethod: "MANUAL",
    });
    expect(mapBrokerisEndorsement(33)?.partyChangeKind).toBe("CONTRACTOR");
    expect(mapBrokerisEndorsement(9)?.partyChangeKind).toBeNull();
    expect(mapBrokerisEndorsement(0)).toBeNull();
    expect(mapBrokerisEndorsement(99)).toBeNull();
    expect(mapBrokerisMovementKind(0)).toBe("ISSUE");
    expect(mapBrokerisMovementKind(11)).toBe("ENDORSEMENT");
  });

  it("separa periodicidad, despacho, no renovación, cierre y documento", () => {
    expect(mapBrokerisPaymentMethod(408)).toBe("SINGLE");
    expect(mapBrokerisPaymentMethod(596)).toBeNull();
    expect(mapBrokerisPaymentFrequency(408)).toBe("SINGLE");
    expect(mapBrokerisPaymentFrequency(596)).toBe("MONTHLY");
    expect(mapBrokerisPaymentFrequency(597)).toBe("QUARTERLY");
    expect(mapBrokerisPaymentFrequency(598)).toBe("SEMIANNUAL");
    expect(mapBrokerisPaymentFrequency(599)).toBe("ANNUAL");
    expect(mapBrokerisDispatchStatus(1)).toBe("PENDING");
    expect(mapBrokerisDispatchType(1)).toBe("EMAIL");
    expect(mapBrokerisDispatchType(7)).toBe("REGULAR_MAIL");
    expect(mapBrokerisNonRenewalType(1)).toBe("NOT_RENEWABLE");
    expect(mapBrokerisNonRenewalType(2)).toBe("NOT_RENEWED");
    expect(brokerisNonRenewalReasonIds()).toHaveLength(23);
    expect(mapBrokerisNonRenewalReason(22)).toBe("CLIENT_REQUEST");
    expect(mapBrokerisNonRenewalReason(6)).toBe("CANCELLED_MIDTERM");
    expect(mapBrokerisProfile("SUSCRIPTOR")).toBe("ACCOUNT_EXECUTIVE");
    expect(mapBrokerisProfile("SALUD")).toBeNull();
    expect(brokerisClaimClosureIds()).toHaveLength(40);
    expect(mapBrokerisClaimClosure(7)?.outcome).toBe("PAID");
    expect(mapBrokerisClaimClosure(11)?.outcome).toBe("REPAIRED");
    expect(mapBrokerisClaimClosure(40)?.outcome).toBe("TEMPORARY");
    expect(mapBrokerisClaimClosure(10)?.outcome).toBe("OTHER");
    expect(mapBrokerisClaimSubstatus(1).status).toBe("REPORT_PENDING_SEND");
    expect(mapBrokerisClaimSubstatus(999)).toMatchObject({
      status: "REPORTED",
      note: "Subestado sin mapa: 999",
    });
    expect(mapBrokerisDocumentType("Póliza")).toMatchObject({
      code: "POLICY",
      needsReview: false,
    });
    expect(mapBrokerisDocumentType("Mail de Autorización").code).toBe("CREDITOR_AUTHORIZATION");
    expect(mapBrokerisDocumentType("Otros Docs.")).toMatchObject({
      code: "OTHER",
      needsReview: false,
    });
    expect(mapBrokerisDocumentType("Certificado AFP")).toMatchObject({
      code: "OTHER",
      needsReview: true,
      legacyType: "Certificado AFP",
    });
  });
});

describe("cadena y cuadre", () => {
  it("numera la cadena por vigencia y marca madre ausente o ciclo", () => {
    const chain = assignRenewalLineage([
      { id: "c", renewedFromId: "b", sortKey: "2026-01-01" },
      { id: "a", renewedFromId: null, sortKey: "2024-01-01" },
      { id: "b", renewedFromId: "a", sortKey: "2025-01-01" },
    ]);
    expect(chain.map((row) => [row.id, row.lineageId, row.termNumber])).toEqual([
      ["c", "a", 3],
      ["a", "a", 1],
      ["b", "a", 2],
    ]);
    const missing = assignRenewalLineage([
      { id: "b", renewedFromId: "ausente", sortKey: "2026-01-01" },
    ]);
    expect(missing[0]).toMatchObject({ lineageId: "b", termNumber: 1, needsReview: true });
    const cycle = assignRenewalLineage([
      { id: "a", renewedFromId: "b", sortKey: "2024-01-01" },
      { id: "b", renewedFromId: "a", sortKey: "2025-01-01" },
    ]);
    expect(cycle.every((row) => row.needsReview)).toBe(true);
    expect(cycle.map((row) => row.termNumber).sort()).toEqual([1, 2]);
  });

  it("fusiona compañías por RUT y deja la de más pólizas", () => {
    const merges = mergeInsurersByRut([
      { id: "liberty", rut: "99.061.000-2", policyCount: 2 },
      { id: "hdi", rut: "99061000-2", policyCount: 9 },
      { id: "otra", rut: "76.598.625-7", policyCount: 1 },
    ]);
    expect(merges).toEqual([{ rut: "990610002", keepId: "hdi", dropIds: ["liberty"] }]);
  });

  it("acepta el corte de referencia y aplica las tolerancias", () => {
    const ok = evaluateBrokerisCuadre(referenceCuadreInput());
    expect(ok.rows).toHaveLength(13);
    expect(ok.rows.every((row) => row.status === "OK")).toBe(true);
    expect(ok.gateA).toBe(true);
    expect(BROKERIS_LOAD_ORDER).toHaveLength(12);

    const q2 = evaluateBrokerisCuadre({
      ...referenceCuadreInput(),
      endorsementsInForce: 270,
    });
    expect(q2.rows.find((row) => row.code === "Q2")?.status).toBe("FUERA");
    expect(q2.gateA).toBe(true);
    const q2explained = evaluateBrokerisCuadre({
      ...referenceCuadreInput(),
      endorsementsInForce: 270,
      endorsementDifferenceExplained: true,
    });
    expect(q2explained.rows.find((row) => row.code === "Q2")?.status).toBe("EXPLICADO");

    expect(
      evaluateBrokerisCuadre({ ...referenceCuadreInput(), policiesInForce: 1486 }).gateA,
    ).toBe(false);
    expect(
      evaluateBrokerisCuadre({ ...referenceCuadreInput(), policyPremiumDiffsUf: [0.02] }).rows.find(
        (row) => row.code === "Q3",
      )?.status,
    ).toBe("FUERA");
    expect(
      evaluateBrokerisCuadre({ ...referenceCuadreInput(), policyPremiumDiffsUf: [0.01, -0.01] })
        .rows.find((row) => row.code === "Q3")?.status,
    ).toBe("OK");

    const inside = evaluateBrokerisCuadre({
      ...referenceCuadreInput(),
      commissionPaymentsByYear: [
        { year: 2025, brokerisClp: 1000, polizzaClp: 1001, times100Explained: false },
      ],
    });
    expect(inside.rows.find((row) => row.code === "Q10")?.status).toBe("OK");
    const outside = evaluateBrokerisCuadre({
      ...referenceCuadreInput(),
      commissionPaymentsByYear: [
        { year: 2025, brokerisClp: 1000, polizzaClp: 1002, times100Explained: false },
      ],
    });
    expect(outside.rows.find((row) => row.code === "Q10")?.status).toBe("FUERA");
    const explained = evaluateBrokerisCuadre({
      ...referenceCuadreInput(),
      commissionPaymentsByYear: [
        { year: 2025, brokerisClp: 1000, polizzaClp: 1002, times100Explained: true },
      ],
    });
    expect(explained.rows.find((row) => row.code === "Q10")?.status).toBe("EXPLICADO");

    const production = evaluateBrokerisCuadre({
      ...referenceCuadreInput(),
      grossPremium2025Clp: 1_748_700_000,
    });
    expect(production.rows.find((row) => row.code === "Q11")?.status).toBe("OK");
    const productionOut = evaluateBrokerisCuadre({
      ...referenceCuadreInput(),
      grossPremium2025Clp: 1_748_700_001,
    });
    expect(productionOut.rows.find((row) => row.code === "Q11")?.status).toBe("FUERA");
    const productionNoted = evaluateBrokerisCuadre({
      ...referenceCuadreInput(),
      grossPremium2025Clp: 1_748_700_001,
      productionExplained: true,
    });
    expect(productionNoted.rows.find((row) => row.code === "Q11")?.status).toBe("EXPLICADO");
  });

  it("traduce un pegado de pólizas y de endosos", () => {
    const policies = translateBrokerisPaste(
      "POLIZAS",
      "id\testado\trenovacion\tmadre\tvigencia\na\t4\t0\t\t2024-01-01\nb\t4\t1\ta\t2025-01-01",
    );
    expect(policies).toHaveLength(2);
    expect(policies[1]?.payload).toMatchObject({
      status: "ISSUED",
      lineageId: "a",
      termNumber: 2,
      renewedFromId: "a",
    });
    expect(policies[1]?.action).toBe("TRADUCIDO");

    const endorsements = translateBrokerisPaste("ENDOSOS", "e1\t11\ne0\t0");
    expect(endorsements[0]).toMatchObject({ action: "TRADUCIDO" });
    expect(endorsements[0]?.message).toContain("CANCELLATION");
    expect(endorsements[1]?.message).toContain("ISSUE");
    expect(endorsements[1]?.action).toBe("REVISAR");
  });
});
