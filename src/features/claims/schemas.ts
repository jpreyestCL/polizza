import { z } from "zod";

export const CLAIM_STATUSES = [
  "REPORTADO",
  "EN_EVALUACION",
  "APROBADO",
  "RECHAZADO",
  "PAGADO",
  "CERRADO",
] as const;

export type ClaimStatusValue = (typeof CLAIM_STATUSES)[number];

export const CLAIM_STATUS_LABELS: Record<ClaimStatusValue, string> = {
  REPORTADO: "Reportado",
  EN_EVALUACION: "En evaluación",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  PAGADO: "Pagado",
  CERRADO: "Cerrado",
};

const optionalAmount = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0),
    "Monto inválido",
  )
  .default("");

export const claimFormSchema = z.object({
  clientId: z.string().min(1, "Selecciona un cliente"),
  policyId: z.string().default(""),
  description: z
    .string()
    .trim()
    .min(1, "Describe el siniestro")
    .max(2000),
  occurredAt: z.string().default(""),
  reportedAt: z.string().default(""),
  estimatedAmount: optionalAmount,
  settledAmount: optionalAmount,
  currency: z.enum(["UF", "CLP", "USD", "USD_OBS", "EUR", "UD"]),
  assignedUserId: z.string().default(""),
});

export type ClaimFormValues = z.infer<typeof claimFormSchema>;

export const claimStatusChangeSchema = z.object({
  status: z.enum(CLAIM_STATUSES),
  note: z.string().trim().max(1000).default(""),
});

export type ClaimStatusChangeValues = z.infer<typeof claimStatusChangeSchema>;
