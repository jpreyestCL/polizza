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
 * Solo los endosos EJECUTADOS mueven el estado. Las "Solicitud de…" son un
 * trámite en curso con la compañía: se registran en la bitácora y el estado
 * cambia recién cuando llega la cancelación o anulación efectiva. El resto
 * (ítems, glosas, montos, prórrogas) no altera la vigencia.
 */
export const ENDORSEMENT_STATUS_EFFECT: Partial<
  Record<EndorsementTypeValue, "CANCELADA" | "ANULADA">
> = {
  ANULACION_COMPANIA: "ANULADA",
  CANCELACION_COMPANIA: "CANCELADA",
  CANCELACION_NO_PAGO: "CANCELADA",
  CORTE_PERDIDA_TOTAL: "CANCELADA",
};

/** Tipos que dejan la póliza fuera de vigencia. */
export function endorsementStatusEffect(
  type: EndorsementTypeValue,
): "CANCELADA" | "ANULADA" | null {
  return ENDORSEMENT_STATUS_EFFECT[type] ?? null;
}

const optionalString = z.string().trim().default("");

export const endorsementSchema = z.object({
  type: z.enum(ENDORSEMENT_TYPES),
  effectiveDate: z.string().min(1, "Fecha efectiva requerida"),
  reason: optionalString,
  notes: optionalString,
});

export type EndorsementValues = z.infer<typeof endorsementSchema>;
