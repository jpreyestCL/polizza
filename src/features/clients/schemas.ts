import { z } from "zod";
import { isValidRut } from "@/lib/rut";

export const CLIENT_TYPES = ["PERSONA", "EMPRESA"] as const;
export const CLIENT_STATUSES = ["PROSPECTO", "ACTIVO", "INACTIVO"] as const;

/** Correo opcional: vacío permitido, o un correo válido. */
const optionalEmail = z.union([
  z.literal(""),
  z.string().email("Correo inválido"),
]);

export const CONTACT_ASSIGNMENTS = [
  "COBRANZA",
  "SINIESTROS",
  "EMISION",
] as const;

export const CONTACT_ASSIGNMENT_LABELS: Record<string, string> = {
  COBRANZA: "Para Cobranza",
  SINIESTROS: "Para Siniestros",
  EMISION: "Para Emisión",
};

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Nombre del contacto requerido"),
  role: z.string().trim().max(80).default(""),
  email: optionalEmail.default(""),
  phone: z.string().trim().max(40).default(""),
  celular: z.string().trim().max(40).default(""),
  assignmentType: z
    .enum(["", "COBRANZA", "SINIESTROS", "EMISION"])
    .default(""),
  isPrimary: z.boolean().default(false),
});

export const clientFormSchema = z
  .object({
    type: z.enum(CLIENT_TYPES),
    status: z.enum(CLIENT_STATUSES),
    rut: z
      .string()
      .trim()
      .min(1, "RUT requerido")
      .refine(isValidRut, "RUT inválido"),
    name: z.string().trim().min(1, "Nombre requerido").max(160),
    legalName: z.string().trim().max(160).default(""),
    giro: z.string().trim().max(160).default(""),
    birthDate: z.string().default(""),
    email: optionalEmail.default(""),
    phone: z.string().trim().max(40).default(""),
    celular: z.string().trim().max(40).default(""),
    address: z.string().trim().max(200).default(""),
    region: z.string().trim().default(""),
    commune: z.string().trim().default(""),
    assignedUserId: z.string().trim().default(""),
    vendedor: z.string().trim().max(120).default(""),
    cobranzaUserId: z.string().trim().default(""),
    siniestrosUserId: z.string().trim().default(""),
    holdingId: z.string().trim().default(""),
    source: z.string().trim().max(80).default(""),
    comentarioAlerta: z.string().trim().max(2000).default(""),
    observaciones: z.string().trim().max(2000).default(""),
    contacts: z.array(contactSchema).max(20).default([]),
  })
  .superRefine((data, ctx) => {
    // Un cliente Activo exige datos de contacto y ubicación completos.
    if (data.status !== "ACTIVO") return;
    const requiredText: {
      field: "address" | "region" | "commune";
      label: string;
    }[] = [
      { field: "address", label: "La dirección" },
      { field: "region", label: "La región" },
      { field: "commune", label: "La comuna" },
    ];
    for (const { field, label } of requiredText) {
      if (!data[field].trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${label} es obligatoria para clientes activos`,
        });
      }
    }
    if (!data.phone.trim() && !data.celular.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["celular"],
        message:
          "Indica al menos un teléfono o celular para clientes activos",
      });
    }
  });

export type ClientFormValues = z.infer<typeof clientFormSchema>;
export type ContactValues = z.infer<typeof contactSchema>;

/** Canales de gestión registrables en el historial del cliente. */
export const INTERACTION_CHANNELS = [
  "CORREO",
  "WHATSAPP",
  "LLAMADA",
  "NOTA",
] as const;

export const INTERACTION_LABELS: Record<string, string> = {
  CORREO: "Correo",
  WHATSAPP: "WhatsApp",
  LLAMADA: "Llamada",
  NOTA: "Nota",
};
