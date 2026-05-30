import { z } from "zod";

/** Entidades a las que se puede adjuntar un documento. */
export type DocumentEntity =
  | "CLIENT"
  | "PROPOSAL"
  | "POLICY"
  | "CLAIM"
  | "CAR_QUOTATION";

/**
 * Tipos de documento que se pueden cargar en una propuesta/póliza.
 * Lista definida por el cliente (doc "Observaciones módulo propuestas").
 */
export const DOCUMENT_TYPES = [
  "Aceptación asegurado/contratante",
  "Acta de entrega",
  "Adjudicación",
  "Autorización compañía",
  "Bases de licitación",
  "Comprobante de pago",
  "Factura",
  "Carta aviso asignación",
  "Carta de renovación",
  "Cédula de identidad",
  "Certificado de anotaciones vigentes",
  "Certificado de dominio vigente",
  "Correo",
  "Cotización compañía",
  "Cuestionario",
  "Excel con el detalle de ítems",
  "Guía de despacho",
  "Informe de inspección",
  "Mandato PAT/PAC",
  "Minuta",
  "Negociación compañía",
  "Orden de compra",
  "Plan de pago",
  "Póliza",
  "Propuesta cía",
  "Otros documentos",
] as const;

/** Documento por enlace externo (Drive/Dropbox). */
export const documentFormSchema = z.object({
  fileName: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  fileUrl: z
    .string()
    .trim()
    .url("Ingresa un enlace válido (https://…)"),
  documentType: z.string().trim().max(80).default(""),
});

export type DocumentFormValues = z.infer<typeof documentFormSchema>;
