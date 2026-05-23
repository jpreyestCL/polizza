import { z } from "zod";

export const POLICY_STATUSES = [
  "VIGENTE",
  "VENCIDA",
  "RENOVADA",
  "CANCELADA",
  "ANULADA",
] as const;

export type PolicyStatusValue = (typeof POLICY_STATUSES)[number];

export const POLICY_STATUS_LABELS: Record<PolicyStatusValue, string> = {
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
  items: z.array(policyItemSchema).default([]),
  coverages: z.array(policyCoverageSchema).default([]),
});

export type PolicyFormValues = z.infer<typeof policyFormSchema>;

export const policyStatusChangeSchema = z.object({
  status: z.enum(POLICY_STATUSES),
  note: z.string().trim().max(1000).default(""),
});

export type PolicyStatusChangeValues = z.infer<typeof policyStatusChangeSchema>;
