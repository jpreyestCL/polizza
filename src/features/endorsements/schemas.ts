import { z } from "zod";

export const ENDORSEMENT_TYPES = [
  "CANCELACION",
  "ANULACION",
  "MODIFICACION",
] as const;
export type EndorsementTypeValue = (typeof ENDORSEMENT_TYPES)[number];

export const ENDORSEMENT_TYPE_LABELS: Record<EndorsementTypeValue, string> = {
  CANCELACION: "Cancelación",
  ANULACION: "Anulación",
  MODIFICACION: "Modificación",
};

const optionalString = z.string().trim().default("");

export const endorsementSchema = z.object({
  type: z.enum(ENDORSEMENT_TYPES),
  effectiveDate: z.string().min(1, "Fecha efectiva requerida"),
  reason: optionalString,
  notes: optionalString,
});

export type EndorsementValues = z.infer<typeof endorsementSchema>;
