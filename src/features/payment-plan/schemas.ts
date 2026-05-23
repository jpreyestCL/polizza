import { z } from "zod";

const optionalString = z.string().trim().default("");
const optionalNumeric = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || !Number.isNaN(Number(v)),
    "Número inválido",
  )
  .default("");

export const PAYMENT_OPTIONS = [
  "CONTADO",
  "AVISO_CUOTA",
  "CHEQUES",
  "PAC",
  "PAT",
  "CUPONERA",
  "OTRO",
] as const;
export type PaymentOptionValue = (typeof PAYMENT_OPTIONS)[number];

export const PAYMENT_OPTION_LABELS: Record<PaymentOptionValue, string> = {
  CONTADO: "Contado",
  AVISO_CUOTA: "Aviso de cuota",
  CHEQUES: "Cheques",
  PAC: "PAC",
  PAT: "PAT",
  CUPONERA: "Cuponera",
  OTRO: "Otro",
};

export const paymentPlanSchema = z.object({
  sinPlanDePago: z.boolean().default(false),
  option: z
    .enum(PAYMENT_OPTIONS)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  installmentsCount: optionalNumeric,
  observations: optionalString,
  documented: z.boolean().default(false),
  firstPaymentDate: optionalString,
  firstSignDate: optionalString,
  valorCuota: optionalNumeric,
  cobrAnticipada: z.boolean().default(false),
  facturaAnticipada: z.boolean().default(false),
  requiereFactura: z.boolean().default(false),
  primaBruta: optionalNumeric,
  cambio: optionalNumeric,
  primaTotalPesos: optionalNumeric,
  payerRut: optionalString,
  payerName: optionalString,
  payerLastName: optionalString,
  payerLegalName: optionalString,
  payerPhone: optionalString,
  payerCelular: optionalString,
  payerEmail: optionalString,
  generateInstallments: z.boolean().default(false),
});

export type PaymentPlanValues = z.infer<typeof paymentPlanSchema>;

export const proposalLogSchema = z.object({
  action: z.string().trim().min(1).default("NOTE"),
  summary: z.string().trim().min(1, "Asunto requerido"),
  nextDueDate: optionalString,
  responsibleUserId: optionalString,
});

export type ProposalLogValues = z.infer<typeof proposalLogSchema>;
