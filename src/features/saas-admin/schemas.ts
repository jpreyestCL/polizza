import { z } from "zod";

const optionalString = z.string().trim().default("");
const optionalNumeric = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0),
    "Número inválido",
  )
  .default("");

export const globalCompanySchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  legalName: optionalString,
  rut: optionalString,
  address: optionalString,
  commune: optionalString,
  city: optionalString,
  url: optionalString,
  logoUrl: optionalString,
  isLife: z.boolean().default(false),
  active: z.boolean().default(true),
});

export type GlobalCompanyValues = z.infer<typeof globalCompanySchema>;

export const branchTypeSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Clave requerida")
    .regex(/^[a-z0-9_]+$/, "Solo minúsculas, números y guion bajo"),
  name: z.string().trim().min(1, "Nombre requerido"),
  category: z.enum(["GENERALES", "VIDA_SALUD"]),
  order: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Number(v)), "Número inválido")
    .default("0"),
  active: z.boolean().default(true),
});

export type BranchTypeValues = z.infer<typeof branchTypeSchema>;

export const branchFieldSchemaSchema = z.object({
  fieldKey: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Solo minúsculas, números y guion bajo"),
  label: z.string().trim().min(1, "Etiqueta requerida"),
  type: z.enum(["text", "number", "date", "select", "textarea"]),
  required: z.boolean().default(false),
  order: optionalNumeric,
  options: optionalString, // JSON-encoded array de {value,label} para selects
  helpText: optionalString,
});

export type BranchFieldSchemaValues = z.infer<typeof branchFieldSchemaSchema>;

export const globalProductSchema = z.object({
  globalCompanyId: z.string().min(1, "Compañía requerida"),
  branchTypeId: z.string().min(1, "Ramo requerido"),
  name: z.string().trim().min(1, "Nombre requerido"),
  code: optionalString,
  commissionAffectPct: optionalNumeric,
  commissionExemptPct: optionalNumeric,
  active: z.boolean().default(true),
});

export type GlobalProductValues = z.infer<typeof globalProductSchema>;

export const globalProductCoverageSchema = z.object({
  order: optionalNumeric,
  name: z.string().trim().min(1, "Nombre requerido"),
  polCad: optionalString,
  text: optionalString,
  insuredAmount: optionalNumeric,
  type: z.enum(["COBERTURA", "ADICIONAL"]),
  isCommercialValue: z.boolean().default(false),
  affectedByIva: z.boolean().default(false),
  sumsToTotal: z.boolean().default(true),
});

export type GlobalProductCoverageValues = z.infer<
  typeof globalProductCoverageSchema
>;

// ─── Vehículos (maestros globales) ───────────────────────────────────

export const vehicleBrandSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(80),
  active: z.boolean().default(true),
});
export type VehicleBrandValues = z.infer<typeof vehicleBrandSchema>;

export const vehicleModelSchema = z.object({
  brandId: z.string().min(1, "Marca requerida"),
  name: z.string().trim().min(1, "Nombre requerido").max(120),
  active: z.boolean().default(true),
});
export type VehicleModelValues = z.infer<typeof vehicleModelSchema>;

export const vehicleTypeSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(80),
  active: z.boolean().default(true),
});
export type VehicleTypeValues = z.infer<typeof vehicleTypeSchema>;
