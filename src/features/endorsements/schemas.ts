import { z } from "zod";

export const ENDORSEMENT_TYPES = [
  "AGREGA_ITEMS",
  "ELIMINA_ITEMS",
  "ANULACION_ENDOSO",
  "ANULACION_COMPANIA",
  "CAMBIO_ASEGURADO_POLIZA",
  "CAMBIO_ASEGURADO_ITEM",
  "CANCELACION_COMPANIA",
  "CANCELACION_NO_PAGO",
  "CORTE_PERDIDA_TOTAL",
  "ENDOSO_INTERNO",
  "MODIFICACION_GLOSA_ITEM",
  "MODIFICA_MONTO_PRIMA",
  "MODIFICACION",
  "PRORROGA",
  "SOLICITUD_ANULACION",
  "SOLICITUD_CANCELACION",
] as const;
export type EndorsementTypeValue = (typeof ENDORSEMENT_TYPES)[number];

export const ENDORSEMENT_TYPE_LABELS: Record<EndorsementTypeValue, string> = {
  AGREGA_ITEMS: "Agrega ítems",
  ELIMINA_ITEMS: "Elimina ítems",
  ANULACION_ENDOSO: "Anulación de endoso",
  ANULACION_COMPANIA: "Anulación por compañía",
  CAMBIO_ASEGURADO_POLIZA: "Cambio asegurado y/o beneficiario de la póliza",
  CAMBIO_ASEGURADO_ITEM: "Cambio asegurado y/o beneficiario de ítem",
  CANCELACION_COMPANIA: "Cancelación por compañía",
  CANCELACION_NO_PAGO: "Cancelación por no pago",
  CORTE_PERDIDA_TOTAL: "Corte por pérdida total",
  ENDOSO_INTERNO: "Endoso interno",
  MODIFICACION_GLOSA_ITEM: "Modificación glosa por ítem",
  MODIFICA_MONTO_PRIMA: "Modifica monto asegurado y prima",
  MODIFICACION: "Modificación",
  PRORROGA: "Prórroga",
  SOLICITUD_ANULACION: "Solicitud de anulación",
  SOLICITUD_CANCELACION: "Solicitud de cancelación",
};

/**
 * Efecto de cada tipo de endoso sobre el estado de la póliza.
 *
 * Tabla definida por la corredora (planilla "cambio de estados endosos",
 * 2026-09-16). Las solicitudes SÍ mueven el estado: para la corredora la
 * solicitud ya deja la póliza fuera de vigencia, no espera la confirmación de
 * la compañía. Los endosos de ítems, glosas, montos y prórrogas no la alteran.
 */
export const ENDORSEMENT_STATUS_EFFECT: Partial<
  Record<EndorsementTypeValue, "CANCELADA" | "ANULADA">
> = {
  ANULACION_ENDOSO: "ANULADA",
  ANULACION_COMPANIA: "ANULADA",
  SOLICITUD_ANULACION: "ANULADA",
  CANCELACION_COMPANIA: "CANCELADA",
  CANCELACION_NO_PAGO: "CANCELADA",
  SOLICITUD_CANCELACION: "CANCELADA",
};

/** Tipos que dejan la póliza fuera de vigencia. */
export function endorsementStatusEffect(
  type: EndorsementTypeValue,
): "CANCELADA" | "ANULADA" | null {
  return ENDORSEMENT_STATUS_EFFECT[type] ?? null;
}

const optionalString = z.string().trim().default("");

/** Vacío o un número con signo. La coma decimal se acepta. */
export const optionalPremiumDelta = z
  .string()
  .trim()
  .default("")
  .refine((value) => {
    if (!value) return true;
    return Number.isFinite(Number(value.replace(",", ".")));
  }, "Ingresa un monto válido");

export function parsePremiumDelta(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const amount = Number(trimmed);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Cancelación y anulación calculan el crédito de prima. El corte por
 * pérdida total no cierra el plan: si cambia la prima, se informa el delta.
 */
export function endorsementUsesCalculatedCredit(
  type: EndorsementTypeValue,
): boolean {
  return (
    endorsementStatusEffect(type) != null && type !== "CORTE_PERDIDA_TOTAL"
  );
}

/**
 * Cómo se crea el endoso:
 *  - PROPUESTA: genera una propuesta de endoso que recorre el mismo flujo que
 *    una propuesta de póliza (PDF → envío a la cía → recepción → despacho al
 *    cliente). El endoso queda registrado en la póliza recién al despacharla.
 *  - DIRECTO: registra un endoso ya emitido por la compañía (p.ej. una
 *    cancelación por no pago que inicia la propia compañía).
 */
export const ENDORSEMENT_MODES = ["PROPUESTA", "DIRECTO"] as const;
export type EndorsementMode = (typeof ENDORSEMENT_MODES)[number];

// El motivo ya no se pide: el tipo de endoso indica lo que hay que hacer en la
// póliza y el detalle describe el cambio.
export const endorsementSchema = z
  .object({
    mode: z.enum(ENDORSEMENT_MODES).default("PROPUESTA"),
    type: z.enum(ENDORSEMENT_TYPES),
    effectiveDate: z.string().min(1, "Fecha de inicio del endoso requerida"),
    endDate: optionalString,
    detail: z.string().trim().max(20000).default(""),
    endorsementNumber: optionalString,
    notes: optionalString,
    premiumAffectedDelta: optionalPremiumDelta,
    premiumExemptDelta: optionalPremiumDelta,
  })
  .superRefine((val, ctx) => {
    if (val.mode === "PROPUESTA" && !val.detail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["detail"],
        message: "Describe el detalle del endoso para la compañía",
      });
    }
    if (val.endDate && val.effectiveDate && val.endDate < val.effectiveDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "El fin del endoso no puede ser anterior al inicio",
      });
    }
  });

export type EndorsementValues = z.infer<typeof endorsementSchema>;

/** Edición de una propuesta de endoso (mientras está en elaboración). */
export const endorsementProposalSchema = z
  .object({
    type: z.enum(ENDORSEMENT_TYPES),
    effectiveDate: z.string().min(1, "Fecha de inicio del endoso requerida"),
    endDate: optionalString,
    detail: z
      .string()
      .trim()
      .min(1, "Describe el detalle del endoso para la compañía")
      .max(20000),
    observations: optionalString,
    premiumAffectedDelta: optionalPremiumDelta,
    premiumExemptDelta: optionalPremiumDelta,
  })
  .superRefine((val, ctx) => {
    if (val.endDate && val.endDate < val.effectiveDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "El fin del endoso no puede ser anterior al inicio",
      });
    }
  });

export type EndorsementProposalValues = z.infer<
  typeof endorsementProposalSchema
>;

/**
 * Valida si un endoso de este tipo se puede aplicar a una póliza en el estado
 * dado. Solo restringe los que mueven el estado; el resto se registra siempre.
 * Devuelve el mensaje de error o null si es válido.
 */
export function endorsementTransitionError(
  type: EndorsementTypeValue,
  policyStatus: string,
): string | null {
  const next = endorsementStatusEffect(type);
  if (next === "CANCELADA" && !["VIGENTE", "VENCIDA"].includes(policyStatus)) {
    return "Solo se puede cancelar una póliza vigente o vencida.";
  }
  if (next === "ANULADA" && policyStatus === "ANULADA") {
    return "La póliza ya está anulada.";
  }
  return null;
}

/**
 * Endosos que normalmente inicia la propia compañía (no hay propuesta que
 * enviarle): el formulario sugiere registrarlos directamente.
 */
export const COMPANY_INITIATED_TYPES: EndorsementTypeValue[] = [
  "ANULACION_COMPANIA",
  "CANCELACION_COMPANIA",
  "CANCELACION_NO_PAGO",
  "CORTE_PERDIDA_TOTAL",
];
