import { z } from "zod";

/** Entidades a las que se puede adjuntar un documento. */
export type DocumentEntity =
  | "CLIENT"
  | "PROPOSAL"
  | "POLICY"
  | "CLAIM"
  | "CAR_QUOTATION";

export const DOCUMENT_TYPES = [
  "Póliza",
  "Propuesta",
  "Cédula de identidad",
  "Comprobante de pago",
  "Anexo",
  "Otro",
] as const;

export const documentFormSchema = z.object({
  fileName: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  fileUrl: z
    .string()
    .trim()
    .url("Ingresa un enlace válido (https://…)"),
  documentType: z.string().trim().max(60).default(""),
});

export type DocumentFormValues = z.infer<typeof documentFormSchema>;
