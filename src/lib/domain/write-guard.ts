import { factoryRoleOf, hasPermission } from "@/lib/factory-roles";

const PARTIES = ["parties.write", "parties.merge", "privacy.manage"];
const CATALOG = ["catalog.manage", "settings.manage"];
const PROPOSALS = [
  "policies.write",
  "policies.send",
  "policies.issue",
  "policies.discard",
  "policies.reopen",
  "policies.edit_issued",
  "endorsements.write",
  "endorsements.issue",
  "renewals.manage",
  "renewals.bulk",
  "dispatch.manage",
  "quotes.write",
];
const POLICIES = [
  ...PROPOSALS,
  "policies.force_status",
  "policies.change_number",
  "endorsements.issue_nonpayment_cancellation",
  "endorsements.override_inalterability",
];
const LEDGER = [...POLICIES, "commissions.reconcile", "installments.mark_paid"];
const COLLECTIONS = [
  "installments.mark_paid",
  "installments.edit_paid",
  "installments.write_off",
  "collections.send_reminders",
  "payments.no_plan",
];
const COMMISSIONS = [
  "commissions.reconcile",
  "commissions.accept_difference",
  "commissions.reopen",
  "commissions.delete_payment",
];
const CLAIMS = [
  "claims.write",
  "claims.close",
  "claims.reopen",
  "claims.edit_closed",
  "claims.void",
];

/**
 * Permisos que habilitan escribir cada modelo de la corredora. Basta uno.
 * Es la red de seguridad bajo cada acción: un rol sin ninguno de esos
 * permisos no puede crear, editar ni borrar filas del modelo. Importar no
 * figura aquí: el lote corre con `requireOrgDbFor("imports.run")`.
 */
export const MODEL_WRITE_PERMISSIONS: Record<string, readonly string[]> = {
  Client: [...PARTIES, "policies.write", "quotes.write"],
  ClientContact: [...PARTIES, "policies.write"],
  ClientRelationship: PARTIES,
  ClientTag: PARTIES,
  ClientTagAssignment: PARTIES,
  Holding: PARTIES,
  Branch: PARTIES,

  InsuranceCompany: CATALOG,
  InsuranceCompanyContact: CATALOG,
  InsuranceLine: [...CATALOG, "quotes.write", "policies.write"],
  InsuranceProduct: [...CATALOG, "policies.write"],
  TenantProductCoverage: [...CATALOG, "policies.write"],
  Broker: CATALOG,
  OrganizationSettings: CATALOG,
  InsurerPortalCredential: ["settings.manage"],
  SalespersonCommissionRate: ["settings.manage", ...COMMISSIONS],

  Proposal: PROPOSALS,
  ProposalItem: PROPOSALS,
  ProposalItemCoverage: PROPOSALS,
  PaymentPlan: [...PROPOSALS, ...COLLECTIONS],
  ProposalLog: [...PROPOSALS, ...COLLECTIONS],
  ProposalStatusHistory: PROPOSALS,
  ProposalReturnReason: PROPOSALS,
  ProposalBrokerParticipation: PROPOSALS,
  ProposalCoaseguroParticipation: PROPOSALS,
  PolicySubmission: PROPOSALS,
  AiComparison: [...PROPOSALS, "ai.extract"],
  AiDiscrepancy: [...PROPOSALS, "ai.extract"],
  AiExtraction: ["ai.extract"],
  QuoteRequest: ["quotes.write", "quotes.send"],
  QuoteOffer: ["quotes.write", "quotes.send"],
  CarQuotation: ["quotes.write", "policies.write"],
  CarQuotationResult: ["quotes.write", "policies.write"],

  Policy: [...LEDGER, ...COLLECTIONS, ...CLAIMS],
  PolicyItem: POLICIES,
  PolicyCoverage: POLICIES,
  PolicyStatusHistory: [...POLICIES, ...COLLECTIONS],
  Endorsement: POLICIES,
  PremiumMovement: [...LEDGER, ...COLLECTIONS],
  CommissionReceivable: [...LEDGER, ...COMMISSIONS, ...COLLECTIONS],
  Dispatch: [...POLICIES, "dispatch.manage"],

  Installment: [...PROPOSALS, ...COLLECTIONS, ...POLICIES],
  InstallmentPayment: COLLECTIONS,

  CommissionStatement: COMMISSIONS,
  CommissionStatementLine: COMMISSIONS,
  CommissionAllocation: COMMISSIONS,
  CompanyCommissionPayment: COMMISSIONS,
  SellerCommissionSettlement: COMMISSIONS,
  SellerCommissionSettlementItem: COMMISSIONS,

  Claim: CLAIMS,
  ClaimAdjustmentExtension: CLAIMS,
  ClaimStatusHistory: CLAIMS,
  ClaimThirdParty: CLAIMS,
  ClaimLog: CLAIMS,

  ImportJob: ["imports.run", "imports.revert"],
  ImportJobRow: ["imports.run", "imports.revert"],
};

/** Escrituras de apoyo que cualquier rol con algo que hacer puede dejar. */
const SUPPORT_MODELS = new Set([
  "ActivityLog",
  "IdempotencyRecord",
  "Task",
  "Alert",
  "Comment",
  "Document",
  "DocumentVersion",
  // Las acciones crean las filas por defecto la primera vez que consultan.
  "TenantFeature",
]);

export const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

export function canWriteModel(role: string, model: string): boolean {
  const factory = factoryRoleOf(role);
  if (!factory) return false;
  if (factory === "ADMIN") return true;
  if (SUPPORT_MODELS.has(model)) return factory !== "READ_ONLY";
  const allowed = MODEL_WRITE_PERMISSIONS[model];
  if (!allowed) return false;
  return allowed.some((code) => hasPermission(role, code));
}

export class WriteForbiddenError extends Error {
  constructor(model: string) {
    super(`Tu rol no permite modificar este dato (${model}).`);
    this.name = "WriteForbiddenError";
  }
}
