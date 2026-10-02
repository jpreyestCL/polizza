import { z } from "zod";

export const PORTFOLIO_POLICY_STATUSES = [
  "VIGENTE",
  "VENCIDA",
  "RENOVADA",
  "CANCELADA",
  "ANULADA",
] as const;

export const POLICY_STATUSES = [
  "BORRADOR",
  "ENVIADA",
  "POR_DESPACHAR",
  "RECHAZADA",
  "DESCARTADA",
  ...PORTFOLIO_POLICY_STATUSES,
] as const;

export type PolicyStatusValue = (typeof POLICY_STATUSES)[number];

/** 23 motivos de Brokeris. Los seis textos viejos siguen leyéndose. */
export const NON_RENEWAL_REASONS = [
  "CLIENT_REQUEST",
  "CLAIM_SERVICE",
  "BROKER_CHANGE",
  "BUSINESS_CLOSED",
  "INSURER_CHANGE",
  "COVERAGE",
  "RESTRICTED_TERMS",
  "INSURER_DECISION",
  "BULK",
  "MERGED_POLICY",
  "OTHER",
  "REPLACED",
  "PRICE",
  "BANKRUPTCY",
  "SERVICE",
  "NO_MARKET",
  "NO_CLIENT_RESPONSE",
  "ECONOMIC_SITUATION",
  "PROJECT_ENDED",
  "SINGLE_SHIPMENT",
  "ASSET_SOLD",
  "TOTAL_LOSS",
  "CANCELLED_MIDTERM",
] as const;

export type NonRenewalReason = (typeof NON_RENEWAL_REASONS)[number];

export const NON_RENEWAL_REASON_LABELS: Record<NonRenewalReason, string> = {
  CLIENT_REQUEST: "Decisión del cliente",
  CLAIM_SERVICE: "Servicio en el siniestro",
  BROKER_CHANGE: "Cambio de corredor",
  BUSINESS_CLOSED: "Cierre del negocio",
  INSURER_CHANGE: "Cambio de compañía",
  COVERAGE: "Cobertura",
  RESTRICTED_TERMS: "Condiciones restringidas",
  INSURER_DECISION: "Decisión de la compañía",
  BULK: "Carga masiva",
  MERGED_POLICY: "Póliza fusionada",
  OTHER: "Otro",
  REPLACED: "Reemplazada",
  PRICE: "Precio",
  BANKRUPTCY: "Quiebra",
  SERVICE: "Servicio",
  NO_MARKET: "Sin mercado",
  NO_CLIENT_RESPONSE: "Sin respuesta del cliente",
  ECONOMIC_SITUATION: "Situación económica",
  PROJECT_ENDED: "Fin del proyecto",
  SINGLE_SHIPMENT: "Embarque único",
  ASSET_SOLD: "Vendió el bien",
  TOTAL_LOSS: "Pérdida total",
  CANCELLED_MIDTERM: "Cancelada a mitad de vigencia",
};

const LEGACY_NON_RENEWAL_LABELS: Record<string, string> = {
  PRECIO: "Precio",
  CAMBIO_COMPANIA: "Cambio de compañía",
  CLIENTE_NO_RENOVO: "El cliente no renovó",
  VENTA_BIEN: "Vendió el bien",
  SIN_RESPUESTA: "Sin respuesta",
  OTRO: "Otro",
};

export function nonRenewalReasonLabel(code: string | null | undefined): string {
  if (!code) return "";
  if (code in NON_RENEWAL_REASON_LABELS) {
    return NON_RENEWAL_REASON_LABELS[code as NonRenewalReason];
  }
  return LEGACY_NON_RENEWAL_LABELS[code] ?? code;
}

export const nonRenewalSchema = z.object({
  reason: z.enum(NON_RENEWAL_REASONS),
  note: z.string().trim().max(500).default(""),
});

export type NonRenewalValues = z.infer<typeof nonRenewalSchema>;

export const POLICY_STATUS_LABELS: Record<PolicyStatusValue, string> = {
  BORRADOR: "En elaboración",
  ENVIADA: "Enviada a la compañía",
  POR_DESPACHAR: "Por despachar",
  RECHAZADA: "Rechazada",
  DESCARTADA: "Descartada",
  VIGENTE: "Vigente",
  VENCIDA: "Vencida",
  RENOVADA: "Renovada",
  CANCELADA: "Cancelada (vía endoso)",
  ANULADA: "Anulada (vía endoso)",
};

/** Monto opcional: vacío o número no negativo, como string. */
const optionalAmount = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0),
    "Monto inválido",
  )
  .default("");

export const policyItemSchema = z.object({
  description: z.string().trim().min(1, "Describe el bien asegurado"),
  insuredAmount: optionalAmount,
});

export const policyCoverageSchema = z.object({
  name: z.string().trim().min(1, "Nombre de cobertura requerido"),
  deductible: z.string().trim().max(120).default(""),
  insuredAmount: optionalAmount,
});

export const policyFormSchema = z.object({
  clientId: z.string().min(1, "Selecciona un cliente"),
  proposalId: z.string().default(""),
  policyNumber: z.string().trim().min(1, "Número de póliza requerido").max(60),
  companyId: z.string().default(""),
  lineId: z.string().default(""),
  branchId: z.string().default(""),
  premiumNet: optionalAmount,
  currency: z.enum(["UF", "CLP", "USD", "USD_OBS", "EUR", "UD"]),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  assignedUserId: z.string().default(""),
  // Vendedor cuya comisión se liquida sobre esta póliza.
  salespersonId: z.string().default(""),
  items: z.array(policyItemSchema).default([]),
  coverages: z.array(policyCoverageSchema).default([]),
});

export type PolicyFormValues = z.infer<typeof policyFormSchema>;

export const policyStatusChangeSchema = z.object({
  status: z.enum(PORTFOLIO_POLICY_STATUSES),
  note: z.string().trim().max(1000).default(""),
});

export type PolicyStatusChangeValues = z.infer<typeof policyStatusChangeSchema>;
