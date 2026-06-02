import { z } from "zod";
import { CURRENCIES } from "@/lib/money";

export const PROPOSAL_STATUSES = [
  "ELABORACION",
  "POR_ENVIAR",
  "ENVIADA_COMPANIA",
  "DEVUELTA",
  "POR_DESPACHAR",
] as const;

export type ProposalStatusValue = (typeof PROPOSAL_STATUSES)[number];

export const STATUS_LABELS: Record<ProposalStatusValue, string> = {
  ELABORACION: "En elaboración",
  POR_ENVIAR: "Por enviar a la cía",
  ENVIADA_COMPANIA: "Enviada a compañía",
  DEVUELTA: "Devuelta a la cía",
  POR_DESPACHAR: "Por despachar",
};

/** Estados en los que la propuesta queda bloqueada para edición. */
export const LOCKED_STATUSES: ProposalStatusValue[] = [
  "POR_ENVIAR",
  "ENVIADA_COMPANIA",
  "POR_DESPACHAR",
];

export function isProposalLocked(status: string): boolean {
  return (LOCKED_STATUSES as string[]).includes(status);
}

/** Monto opcional: vacío o número no negativo, como string (input controlado). */
const optionalAmount = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0),
    "Monto inválido",
  )
  .default("");

const optionalString = z.string().trim().default("");

// Detalle de coaseguro / co-corredor / reaseguro como JSON estructurado.
// Forma libre por ahora — el front lo edita como JSON o string semi-libre.
const otherPartiesDetail = z
  .object({
    party: optionalString,
    pct: optionalString,
    amount: optionalString,
    notes: optionalString,
  })
  .partial()
  .optional()
  .nullable();

/** Fila de participación de coaseguro (compañía + %). */
export const coaseguroParticipationSchema = z.object({
  insuranceCompanyId: z.string().min(1, "Compañía requerida"),
  participationPct: z
    .string()
    .trim()
    .refine(
      (v) => v !== "" && !Number.isNaN(Number(v)) && Number(v) > 0,
      "Porcentaje requerido",
    ),
  policyNumber: optionalString,
});

export type CoaseguroParticipationValues = z.infer<
  typeof coaseguroParticipationSchema
>;

/** Fila de participación de co-corredor (corredora + %). */
export const brokerParticipationSchema = z.object({
  brokerId: z.string().min(1, "Corredora requerida"),
  participationPct: z
    .string()
    .trim()
    .refine(
      (v) => v !== "" && !Number.isNaN(Number(v)) && Number(v) > 0,
      "Porcentaje requerido",
    ),
});

export type BrokerParticipationValues = z.infer<
  typeof brokerParticipationSchema
>;

function sumsTo100(rows: { participationPct: string }[]): boolean {
  if (rows.length === 0) return true;
  const total = rows.reduce((s, r) => s + Number(r.participationPct || 0), 0);
  return Math.abs(total - 100) < 0.01;
}

export const proposalFormSchema = z.object({
  clientId: z.string().min(1, "Selecciona un contratante"),
  insuredClientId: optionalString,
  beneficiaryClientId: optionalString,
  insuranceCompanyId: optionalString,
  branchTypeId: optionalString,
  productId: optionalString,
  // legacy:
  lineId: optionalString,
  branchId: optionalString,
  premiumNet: optionalAmount,
  premiumGross: optionalAmount,
  currency: z.enum(CURRENCIES),
  startDate: optionalString,
  endDate: optionalString,
  startTime: optionalString, // hora de inicio de vigencia "HH:mm" (obs 10)
  endTime: optionalString, // hora de fin de vigencia "HH:mm" (obs 10)
  sentAt: optionalString, // fecha envío a la cía
  recipientEmail: optionalString,
  recipientContactId: optionalString,
  // Contacto del contratante a nivel propuesta (obs 4 y 12): default desde la
  // ficha del cliente, editable por el corredor; el PDF usa estos datos.
  contratanteEmail: optionalString,
  contratantePhone: optionalString,
  contratanteCelular: optionalString,
  quotationId: optionalString,
  quotationNumberRef: optionalString,
  previousPolicyId: optionalString,
  // Relaciones:
  coaseguro: z.boolean().default(false),
  coaseguroDetails: otherPartiesDetail,
  coaseguroParticipations: z.array(coaseguroParticipationSchema).default([]),
  coCorredor: z.boolean().default(false),
  coCorredorDetails: otherPartiesDetail,
  brokerParticipations: z.array(brokerParticipationSchema).default([]),
  reaseguro: z.boolean().default(false),
  reaseguroDetails: otherPartiesDetail,
  deOtroCorredor: z.boolean().default(false),
  garantiaSuscripcion: z.boolean().default(false),
  garantiaObservations: optionalString,
  garantiaExpiry: optionalString,
  garantiaCompleted: z.boolean().default(false),
  garantiaCompletedAt: optionalString,
  conReserva: z.boolean().default(false),
  conClausulaInalterabilidad: z.boolean().default(false),
  facultativo: z.boolean().default(false),
  // Renovación
  isRenewal: z.boolean().default(false),
  previousPolicyNumberText: optionalString,
  // Comisión:
  commissionAffectPct: optionalAmount,
  commissionExemptPct: optionalAmount,
  observations: optionalString,
  assignedUserId: optionalString,
  salespersonId: optionalString,
})
.superRefine((val, ctx) => {
  // Campos obligatorios para poder GUARDAR la propuesta y generar su número
  // (doc "Observaciones módulo propuestas", punto 2).
  const requiredFields: { key: keyof typeof val; message: string }[] = [
    { key: "insuredClientId", message: "Asegurado requerido" },
    { key: "beneficiaryClientId", message: "Beneficiario requerido" },
    { key: "insuranceCompanyId", message: "Compañía requerida" },
    { key: "branchTypeId", message: "Ramo requerido" },
    { key: "productId", message: "Producto requerido" },
    { key: "startDate", message: "Inicio de vigencia requerido" },
    { key: "endDate", message: "Fin de vigencia requerido" },
    { key: "recipientEmail", message: "Email destinatario requerido" },
    { key: "commissionAffectPct", message: "Comisión afecta requerida" },
    { key: "commissionExemptPct", message: "Comisión exenta requerida" },
  ];
  for (const { key, message } of requiredFields) {
    const v = val[key];
    if (typeof v === "string" && v.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message,
      });
    }
  }
  if (val.coaseguro && val.coaseguroParticipations.length > 0) {
    if (!sumsTo100(val.coaseguroParticipations)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["coaseguroParticipations"],
        message: "Las participaciones de coaseguro deben sumar 100%",
      });
    }
  }
  if (val.coCorredor && val.brokerParticipations.length > 0) {
    if (!sumsTo100(val.brokerParticipations)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["brokerParticipations"],
        message: "Las participaciones de co-corredor deben sumar 100%",
      });
    }
  }
  if (!val.deOtroCorredor) {
    const aff = Number(val.commissionAffectPct || 0);
    const exe = Number(val.commissionExemptPct || 0);
    if (
      val.commissionAffectPct !== "" &&
      val.commissionExemptPct !== "" &&
      aff === 0 &&
      exe === 0
    ) {
      // Permitido pero no obligatorio; sin error explícito.
    }
  }
});

export type ProposalFormValues = z.infer<typeof proposalFormSchema>;

/** Validación mínima para guardar borrador: contratante + cía + (ramo o línea+ramo legacy). */
export const proposalDraftSchema = z
  .object({
    clientId: z.string().min(1, "Selecciona un contratante"),
    insuranceCompanyId: z.string().min(1, "Selecciona compañía"),
    branchTypeId: optionalString,
    lineId: optionalString,
    branchId: optionalString,
  })
  .refine(
    (v) => v.branchTypeId !== "" || (v.lineId !== "" && v.branchId !== ""),
    {
      message: "Selecciona ramo (o línea+ramo legacy)",
      path: ["branchTypeId"],
    },
  );

export type ProposalDraftValues = z.infer<typeof proposalDraftSchema>;

/**
 * Recepción de la póliza emitida por la compañía (flujo post-envío).
 * Si la emisión fue correcta → estado POR_DESPACHAR (obs 8). Si hubo error →
 * estado DEVUELTA ("devuelta a la cía") con su motivo.
 */
export const EMISSION_ERROR_REASONS = [
  "Por digitación",
  "Error en la vigencia",
  "Error en la prima",
  "Error en las coberturas",
  "Error en las condiciones particulares",
  "Múltiples errores",
  "Corredor incorrecto",
  "Otros",
] as const;

export type EmissionErrorReason = (typeof EMISSION_ERROR_REASONS)[number];

export const policyReceptionSchema = z.object({
  policyNumber: z.string().trim().min(1, "Número de póliza requerido"),
  emissionDate: z.string().trim().min(1, "Fecha de emisión requerida"),
  receptionDate: z.string().trim().min(1, "Fecha de recepción requerida"),
  note: z.string().trim().max(1000).default(""),
});
export type PolicyReceptionValues = z.infer<typeof policyReceptionSchema>;

export const emissionErrorSchema = z.object({
  reason: z.enum(EMISSION_ERROR_REASONS, {
    errorMap: () => ({ message: "Selecciona un motivo" }),
  }),
  // Obs 16: al recibir la póliza con error también se solicita el número de
  // póliza generado por la compañía y la fecha de recepción.
  policyNumber: z.string().trim().min(1, "Número de póliza generado requerido"),
  receptionDate: z.string().trim().min(1, "Fecha de recepción requerida"),
  detail: z.string().trim().max(1000).default(""),
});
export type EmissionErrorValues = z.infer<typeof emissionErrorSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(PROPOSAL_STATUSES),
  note: z.string().trim().max(1000).default(""),
  returnReasonId: z.string().default(""),
});

export type StatusChangeValues = z.infer<typeof statusChangeSchema>;

/**
 * Despacho de la póliza al contratante (obs 19-20). `send=true` genera un mail
 * tipo con la póliza adjunta + documentos seleccionados de la carátula;
 * `send=false` solo marca la propuesta como Despachada.
 */
export const policyDispatchSchema = z.object({
  send: z.boolean().default(true),
  toEmail: z.string().trim().default(""),
  subject: z.string().trim().max(200).default(""),
  body: z.string().trim().max(5000).default(""),
  documentIds: z.array(z.string()).default([]),
});

export type PolicyDispatchValues = z.infer<typeof policyDispatchSchema>;
