import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDeductible } from "@/lib/domain/deductible";
import { presumedPaidDecision } from "@/lib/domain/presumed-paid";
import { matchCommissionLines } from "@/lib/domain/commission-match";
import { compareIssuance } from "@/lib/domain/issuance-compare";
import {
  mapBrokerisClaimStatus,
  mapBrokerisClientType,
  mapBrokerisCurrency,
  mapBrokerisDispatchStatus,
  mapBrokerisEndorsementType,
  mapBrokerisPaymentMethod,
  mapBrokerisProfile,
  mapBrokerisProposalStatus,
} from "@/lib/domain/brokeris-map";
import {
  claimWorkflow,
  claimWorkflowFamily,
} from "@/lib/domain/claim-workflows";
import { lossRatio } from "@/lib/domain/loss-ratio";
import { buildReportCatalog } from "@/lib/domain/report-catalog";
import {
  FACTORY_ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
} from "@/lib/factory-roles";
import { canSeeAllClients } from "@/lib/roles";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("modelo de la especificación", () => {
  it("la comparación nunca bloquea la emisión", () => {
    const result = compareIssuance([
      { field: "prima", expected: 100, actual: 120 },
      { field: "glosa", expected: "Póliza", actual: "poliza" },
    ]);
    expect(result.blocksIssuance).toBe(false);
    expect(result.verdict).toBe("WITH_PROBLEMS");
    expect(result.discrepancies.map((row) => row.field)).toEqual(["prima"]);
  });

  it("tolera medio por ciento o un centavo en los montos", () => {
    const close = compareIssuance([
      { field: "prima", expected: 10, actual: 10.04 },
    ]);
    expect(close.verdict).toBe("MATCH");
    const far = compareIssuance([
      { field: "prima", expected: 10, actual: 10.2 },
    ]);
    expect(far.verdict).toBe("WITH_PROBLEMS");
    expect(far.blocksIssuance).toBe(false);
  });

  it("estructura el deducible cuando el texto es claro", () => {
    expect(parseDeductible("UF 3")).toMatchObject({ amount: 3, pct: null });
    expect(parseDeductible("10 % mín. UF 5")).toMatchObject({
      pct: 10,
      minimum: 5,
      amount: null,
    });
    expect(parseDeductible("SEGUN MINUTA")).toMatchObject({
      text: "SEGUN MINUTA",
      amount: null,
      pct: null,
    });
  });

  it("no presume pago si el parámetro está apagado", () => {
    expect(
      presumedPaidDecision({
        enabled: false,
        method: "PAC",
        status: "PENDIENTE",
        dueDate: day("2026-01-01"),
        today: day("2026-10-02"),
      }),
    ).toBeNull();
    expect(
      presumedPaidDecision({
        enabled: true,
        method: "PAC",
        status: "PENDIENTE",
        dueDate: day("2026-09-01"),
        today: day("2026-10-02"),
      }),
    ).toBe("PRESUNTA");
    expect(
      presumedPaidDecision({
        enabled: true,
        method: "CONTADO",
        status: "PENDIENTE",
        dueDate: day("2026-01-01"),
        today: day("2026-10-02"),
      }),
    ).toBeNull();
  });

  it("parte una línea y junta varias contra el mismo esperado", () => {
    const split = matchCommissionLines(
      [{ id: "l1", policyNumber: "P-1", amount: 10, currency: "UF" }],
      [
        { id: "r1", policyNumber: "P-1", amount: 6, currency: "UF" },
        { id: "r2", policyNumber: "P-1", amount: 4, currency: "UF" },
      ],
    );
    expect(split.map((row) => row.amount)).toEqual([6, 4]);
    const joined = matchCommissionLines(
      [
        { id: "a", policyNumber: "P-1", amount: 3, currency: "UF" },
        { id: "b", policyNumber: "P-1", amount: 2, currency: "UF" },
      ],
      [{ id: "r", policyNumber: "P-1", amount: 5, currency: "UF" }],
    );
    expect(joined).toHaveLength(2);
    expect(joined.reduce((sum, row) => sum + row.amount, 0)).toBe(5);
  });

  it("traduce los códigos de Brokeris que más mueven la migración", () => {
    expect(mapBrokerisProposalStatus(1).status).toBe("DRAFT");
    expect(mapBrokerisProposalStatus(3)).toMatchObject({
      status: "SENT_TO_INSURER",
      insurerObservation: true,
    });
    expect(mapBrokerisProposalStatus(6, { hasPolicyNumber: true }).status).toBe(
      "ANNULLED",
    );
    expect(mapBrokerisProposalStatus(6).status).toBe("DISCARDED");
    expect(mapBrokerisEndorsementType(32)).toBe("TOTAL_LOSS_TERMINATION");
    expect(mapBrokerisEndorsementType(40)).toBe("REDUCE_TERM");
    expect(mapBrokerisPaymentMethod(410)).toBe("PAC");
    expect(mapBrokerisPaymentMethod(408)).toBe("SINGLE");
    expect(mapBrokerisCurrency(1)).toBe("CLF");
    expect(mapBrokerisClaimStatus(5)).toBe("CLOSED");
    expect(mapBrokerisDispatchStatus(4)).toBe("RETURNED");
    expect(mapBrokerisClientType(2)?.kind).toBe("PERSON");
    expect(mapBrokerisProfile("ADMINISTRADOR")).toBe("ADMIN");
  });

  it("carga las tres plantillas de siniestro", () => {
    expect(claimWorkflow("VEHICLE")[0]).toMatchObject({ dueDays: 1, alertDays: 1 });
    expect(claimWorkflow("PROPERTY").at(-1)).toMatchObject({
      action: "Cierre",
      dueDays: 130,
      alertDays: 30,
    });
    expect(claimWorkflow("PERSONS").map((step) => step.dueDays)).toEqual([
      1, 1, 5, 15, 30, 15, 5,
    ]);
    expect(claimWorkflowFamily("vehiculos_motorizados", "GENERALES")).toBe("VEHICLE");
    expect(claimWorkflowFamily("vida_salud", "VIDA_SALUD")).toBe("PERSONS");
    expect(claimWorkflowFamily("incendio", "GENERALES")).toBe("PROPERTY");
  });

  it("calcula la siniestralidad del ejemplo", () => {
    expect(lossRatio(25, 5, 76.2)).toBeCloseTo(0.3937, 3);
    expect(lossRatio(1, 0, 0)).toBeNull();
  });

  it("el informe de cotizaciones no inventa una tasa de éxito", () => {
    const cards = buildReportCatalog({
      production: [],
      portfolioCount: 0,
      premiumByCurrency: [],
      retentionRate: null,
      retentionUniverse: 0,
      agingCount: 0,
      paymentsInPeriod: 4,
      expectedCommission: [],
      allocatedCommission: 0,
      pendingCommission: [],
      claimsOpen: 0,
      issuedInPeriod: 2,
      issuedWithProblems: 1,
      tasksCreated: 0,
      tasksCompleted: 0,
      tasksOverdue: 0,
      quotationsByStatus: [{ status: "COMPLETADA", count: 3 }],
      lossByCurrency: [],
    });
    const quotes = cards.find((card) => card.id === "R-11");
    const payments = cards.find((card) => card.id === "R-05");
    expect(quotes?.note).toMatch(/no se calcula/);
    expect(quotes?.value).toContain("COMPLETADA");
    expect(payments?.note).toMatch(/cuota/);
    expect(cards.map((card) => card.id)).toEqual([
      "R-01",
      "R-02",
      "R-03",
      "R-04",
      "R-05",
      "R-06",
      "R-07",
      "R-08",
      "R-09",
      "R-10",
      "R-11",
      "R-12",
    ]);
  });

  it("los seis roles ven toda la corredora y el archivo de permisos coincide", () => {
    for (const role of FACTORY_ROLES) {
      expect(canSeeAllClients(role)).toBe(true);
    }
    expect(canSeeAllClients("ejecutivo")).toBe(true);
    expect(hasPermission("ejecutivo", "policies.issue")).toBe(true);
    expect(hasPermission("ejecutivo", "users.manage")).toBe(false);
    expect(hasPermission("gerente", "users.manage")).toBe(true);
    expect(hasPermission("COLLECTIONS", "policies.issue")).toBe(false);
    expect(hasPermission("FINANCE", "commissions.reconcile")).toBe(true);

    const yaml = readFileSync("permissions.yaml", "utf8");
    expect(yaml).toContain("data_scope: TENANT");
    const roles: Record<string, string[]> = {};
    let current: string | null = null;
    let inRoles = false;
    for (const line of yaml.split("\n")) {
      if (line.startsWith("roles:")) {
        inRoles = true;
        continue;
      }
      if (!inRoles) continue;
      const role = line.match(/^  ([A-Z_]+):/);
      if (role?.[1]) {
        current = role[1];
        roles[current] = [];
        continue;
      }
      const code = line.match(/^    - ([a-z0-9_.]+)/);
      if (code?.[1] && current) roles[current].push(code[1]);
    }
    expect(Object.keys(roles).sort()).toEqual([...FACTORY_ROLES].sort());
    for (const role of FACTORY_ROLES) {
      expect(roles[role]).toEqual([...ROLE_PERMISSIONS[role]]);
    }
    const reopen = yaml.split("- code: policies.reopen")[1]?.split("- code:")[0] ?? "";
    expect(reopen).toContain("sensitive: true");
    expect(PERMISSIONS.some((permission) => permission.code === "policies.reopen")).toBe(
      true,
    );
  });
});
