/**
 * Cuadres de la migración Brokeris (06 §8.7), corte 29-09-2026.
 * Q2 es informativo y no entra al Gate A.
 */

export const BROKERIS_REFERENCE_DATE = "2026-09-29";

export const BROKERIS_REFERENCE = {
  policiesInForce: 1487,
  endorsementsInForce: 271,
  contractors: 890,
  insureds: 930,
  companies: 1452,
  persons: 1237,
  renewalsCutMonth: 113,
  renewalsNextMonth: 118,
  openClaims: 145,
  claimsToExtend: 106,
  grossPremium2025Clp: 1_740_000_000,
  commissions2025Clp: 304_000_000,
  maxProposal: 19300,
  maxClaimFolder: 1066,
  maxPlan: 12900,
} as const;

export const BROKERIS_LOAD_ORDER = [
  "Catálogos globales",
  "Corredora, usuarios y roles",
  "Compañías, ramos, productos y coberturas",
  "Clientes y contactos",
  "Pólizas, con la cadena de renovación en orden cronológico",
  "Ítems, coberturas y partes",
  "Endosos y libro de primas",
  "Planes, cuotas y pagos",
  "Comisiones",
  "Siniestros",
  "Bitácoras, tareas y documentos",
  "Contadores",
] as const;

export type CuadreStatus = "OK" | "EXPLICADO" | "FUERA";

export type CommissionYear = {
  year: number;
  brokerisClp: number;
  polizzaClp: number;
  times100Explained: boolean;
};

export type CuadreInput = {
  policiesInForce: number;
  endorsementsInForce: number;
  endorsementDifferenceExplained: boolean;
  policyPremiumDiffsUf: number[];
  commissionDiffsUf: number[];
  commissionLargerDiffsExplained: boolean;
  contractors: number;
  insureds: number;
  companiesBeforeMerge: number;
  personsBeforeMerge: number;
  companiesAfterMerge: number;
  personsAfterMerge: number;
  clientsAfterExplained: boolean;
  renewalsCutMonth: number;
  renewalsNextMonth: number;
  openClaims: number;
  claimsToExtend: number;
  claimsToExtendExplained: boolean;
  pendingInstallmentCount: number;
  pendingInstallmentAmount: number;
  approvedInstallmentCount: number;
  approvedInstallmentAmount: number;
  commissionPaymentsByYear: CommissionYear[];
  grossPremium2025Clp: number;
  commissions2025Clp: number;
  productionExplained: boolean;
  documentsTotal: number;
  documentsLinked: number;
  maxProposal: number;
  maxClaimFolder: number;
  maxPlan: number;
  counterProposal: number;
  counterClaimFolder: number;
  counterPlan: number;
};

export type CuadreRow = {
  code: string;
  label: string;
  reference: string;
  actual: string;
  tolerance: string;
  status: CuadreStatus;
  gate: boolean;
};

export type CuadreReport = {
  rows: CuadreRow[];
  gateA: boolean;
};

const UF = 0.01;

function within(actual: number, expected: number, abs: number): boolean {
  return Math.abs(actual - expected) <= abs + 1e-9;
}

function withinRatio(actual: number, expected: number, ratio: number): boolean {
  if (expected === 0) return actual === 0;
  return Math.abs(actual - expected) / Math.abs(expected) <= ratio + 1e-12;
}

function maxAbs(values: number[]): number {
  return values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
}

function line(input: Omit<CuadreRow, "gate"> & { gate?: boolean }): CuadreRow {
  return { gate: input.gate ?? true, ...input };
}

export function referenceCuadreInput(): CuadreInput {
  const ref = BROKERIS_REFERENCE;
  return {
    policiesInForce: ref.policiesInForce,
    endorsementsInForce: ref.endorsementsInForce,
    endorsementDifferenceExplained: false,
    policyPremiumDiffsUf: [0],
    commissionDiffsUf: [0],
    commissionLargerDiffsExplained: false,
    contractors: ref.contractors,
    insureds: ref.insureds,
    companiesBeforeMerge: ref.companies,
    personsBeforeMerge: ref.persons,
    companiesAfterMerge: ref.companies,
    personsAfterMerge: ref.persons,
    clientsAfterExplained: false,
    renewalsCutMonth: ref.renewalsCutMonth,
    renewalsNextMonth: ref.renewalsNextMonth,
    openClaims: ref.openClaims,
    claimsToExtend: ref.claimsToExtend,
    claimsToExtendExplained: false,
    pendingInstallmentCount: 0,
    pendingInstallmentAmount: 0,
    approvedInstallmentCount: 0,
    approvedInstallmentAmount: 0,
    commissionPaymentsByYear: [
      { year: 2025, brokerisClp: 1_000_000, polizzaClp: 1_000_000, times100Explained: false },
    ],
    grossPremium2025Clp: ref.grossPremium2025Clp,
    commissions2025Clp: ref.commissions2025Clp,
    productionExplained: false,
    documentsTotal: 1,
    documentsLinked: 1,
    maxProposal: ref.maxProposal,
    maxClaimFolder: ref.maxClaimFolder,
    maxPlan: ref.maxPlan,
    counterProposal: ref.maxProposal + 1,
    counterClaimFolder: ref.maxClaimFolder + 1,
    counterPlan: ref.maxPlan + 1,
  };
}

export function evaluateBrokerisCuadre(input: CuadreInput): CuadreReport {
  const ref = BROKERIS_REFERENCE;
  const rows: CuadreRow[] = [];

  rows.push(
    line({
      code: "Q1",
      label: "Pólizas vigentes",
      reference: String(ref.policiesInForce),
      actual: String(input.policiesInForce),
      tolerance: "Exacto",
      status: input.policiesInForce === ref.policiesInForce ? "OK" : "FUERA",
    }),
  );

  const q2match = input.endorsementsInForce === ref.endorsementsInForce;
  rows.push(
    line({
      code: "Q2",
      label: "Endosos vigentes",
      reference: String(ref.endorsementsInForce),
      actual: String(input.endorsementsInForce),
      tolerance: "Informativo: la diferencia se explica",
      status: q2match ? "OK" : input.endorsementDifferenceExplained ? "EXPLICADO" : "FUERA",
      gate: false,
    }),
  );

  const premiumMax = input.policyPremiumDiffsUf.length === 0 ? null : maxAbs(input.policyPremiumDiffsUf);
  rows.push(
    line({
      code: "Q3",
      label: "Prima neta por póliza vigente",
      reference: "Suma del libro",
      actual: premiumMax == null ? "Sin pólizas" : `Máxima diferencia ${premiumMax} UF`,
      tolerance: "± 0,01 UF por póliza",
      status: premiumMax != null && premiumMax <= UF ? "OK" : "FUERA",
    }),
  );

  const commissionMax = input.commissionDiffsUf.length === 0 ? null : maxAbs(input.commissionDiffsUf);
  const commissionOk = commissionMax != null && commissionMax <= UF;
  rows.push(
    line({
      code: "Q4",
      label: "Comisión esperada por movimiento",
      reference: "Libro de Brokeris",
      actual: commissionMax == null ? "Sin movimientos" : `Máxima diferencia ${commissionMax} UF`,
      tolerance: "± 0,01 UF; lo que pase se explica",
      status: commissionOk
        ? "OK"
        : commissionMax != null && input.commissionLargerDiffsExplained
          ? "EXPLICADO"
          : "FUERA",
    }),
  );

  const partiesOk =
    input.contractors === ref.contractors && input.insureds === ref.insureds;
  rows.push(
    line({
      code: "Q5",
      label: "Contratantes y asegurados vigentes",
      reference: `${ref.contractors} contratantes, ${ref.insureds} asegurados`,
      actual: `${input.contractors} contratantes, ${input.insureds} asegurados`,
      tolerance: "Exacto después de las fusiones",
      status: partiesOk ? "OK" : "FUERA",
    }),
  );

  const beforeOk =
    input.companiesBeforeMerge === ref.companies &&
    input.personsBeforeMerge === ref.persons;
  const afterSame =
    input.companiesAfterMerge === ref.companies && input.personsAfterMerge === ref.persons;
  rows.push(
    line({
      code: "Q6",
      label: "Clientes activos",
      reference: `${ref.companies} empresas + ${ref.persons} particulares`,
      actual: `Antes ${input.companiesBeforeMerge}+${input.personsBeforeMerge}; después ${input.companiesAfterMerge}+${input.personsAfterMerge}`,
      tolerance: "Exacto antes de fusionar; explicado después",
      status: !beforeOk
        ? "FUERA"
        : afterSame
          ? "OK"
          : input.clientsAfterExplained
            ? "EXPLICADO"
            : "FUERA",
    }),
  );

  const renewalOk =
    input.renewalsCutMonth === ref.renewalsCutMonth &&
    input.renewalsNextMonth === ref.renewalsNextMonth;
  rows.push(
    line({
      code: "Q7",
      label: "Universo de renovación",
      reference: `${ref.renewalsCutMonth} en el mes del corte y ${ref.renewalsNextMonth} al siguiente`,
      actual: `${input.renewalsCutMonth} y ${input.renewalsNextMonth}`,
      tolerance: "Exacto",
      status: renewalOk ? "OK" : "FUERA",
    }),
  );

  const claimsExact = input.openClaims === ref.openClaims;
  const extendExact = input.claimsToExtend === ref.claimsToExtend;
  rows.push(
    line({
      code: "Q8",
      label: "Siniestros abiertos",
      reference: `${ref.openClaims} abiertos; ${ref.claimsToExtend} por prorrogar se recalculan`,
      actual: `${input.openClaims} abiertos; ${input.claimsToExtend} por prorrogar`,
      tolerance: "Abiertos exactos; la prórroga se explica",
      status: !claimsExact
        ? "FUERA"
        : extendExact
          ? "OK"
          : input.claimsToExtendExplained
            ? "EXPLICADO"
            : "FUERA",
    }),
  );

  const installmentsOk =
    input.pendingInstallmentCount === input.approvedInstallmentCount &&
    within(input.pendingInstallmentAmount, input.approvedInstallmentAmount, UF);
  rows.push(
    line({
      code: "Q9",
      label: "Cuotas pendientes tras la limpieza",
      reference: `${input.approvedInstallmentCount} cuotas, ${input.approvedInstallmentAmount}`,
      actual: `${input.pendingInstallmentCount} cuotas, ${input.pendingInstallmentAmount}`,
      tolerance: "Exacto contra la decisión A/B/C/D",
      status: installmentsOk ? "OK" : "FUERA",
    }),
  );

  const years = input.commissionPaymentsByYear;
  const yearOk = years.length > 0 && years.every((year) => withinRatio(year.polizzaClp, year.brokerisClp, 0.001));
  const yearExplained =
    years.length > 0 &&
    years.every(
      (year) => withinRatio(year.polizzaClp, year.brokerisClp, 0.001) || year.times100Explained,
    );
  rows.push(
    line({
      code: "Q10",
      label: "Pagos de comisión por año",
      reference: "Total de la compañía en pesos",
      actual: years.length === 0 ? "Sin años" : years.map((year) => String(year.year)).join(", "),
      tolerance: "± 0,1 %; la corrección ×100 se explica",
      status: yearOk ? "OK" : yearExplained ? "EXPLICADO" : "FUERA",
    }),
  );

  const premiumOk = withinRatio(input.grossPremium2025Clp, ref.grossPremium2025Clp, 0.005);
  const commissionProductionOk = withinRatio(
    input.commissions2025Clp,
    ref.commissions2025Clp,
    0.005,
  );
  const productionOk = premiumOk && commissionProductionOk;
  rows.push(
    line({
      code: "Q11",
      label: "Producción 2025",
      reference: "Prima bruta 1.740 millones; comisiones 304 millones",
      actual: `${input.grossPremium2025Clp} de prima; ${input.commissions2025Clp} de comisión`,
      tolerance: "± 0,5 % o explicada",
      status: productionOk ? "OK" : input.productionExplained ? "EXPLICADO" : "FUERA",
    }),
  );

  const orphans = input.documentsTotal - input.documentsLinked;
  rows.push(
    line({
      code: "Q12",
      label: "Documentos",
      reference: "Todos enlazados",
      actual: `${input.documentsLinked} de ${input.documentsTotal}`,
      tolerance: "100 % enlazados; el huérfano se lista",
      status: input.documentsTotal >= 0 && orphans === 0 ? "OK" : "FUERA",
    }),
  );

  const countersOk =
    input.counterProposal === input.maxProposal + 1 &&
    input.counterClaimFolder === input.maxClaimFolder + 1 &&
    input.counterPlan === input.maxPlan + 1;
  rows.push(
    line({
      code: "Q13",
      label: "Correlativos",
      reference: `Máximos ≈ ${ref.maxProposal}, ${ref.maxClaimFolder} y ${ref.maxPlan}`,
      actual: `Contadores ${input.counterProposal}, ${input.counterClaimFolder} y ${input.counterPlan}`,
      tolerance: "Contador = máximo + 1",
      status: countersOk ? "OK" : "FUERA",
    }),
  );

  return {
    rows,
    gateA: rows.filter((row) => row.gate).every((row) => row.status !== "FUERA"),
  };
}
