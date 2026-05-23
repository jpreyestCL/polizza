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

// Datos operativos del corredor para una compañía (global o custom).
export const tenantCompanyOperativeSchema = z.object({
  brokerCode: optionalString,
  paymentLink: optionalString,
  bankAccountClp: optionalString,
  bankAccountUsd: optionalString,
  defaultEmail: optionalString,
  status: z.enum(["ACTIVA", "INACTIVA"]).default("ACTIVA"),
});

export type TenantCompanyOperativeValues = z.infer<
  typeof tenantCompanyOperativeSchema
>;

// Compañía custom completa (cuando globalCompanyId será null).
export const tenantCustomCompanySchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  legalName: optionalString,
  rut: optionalString,
  address: optionalString,
  commune: optionalString,
  city: optionalString,
  url: optionalString,
  logoUrl: optionalString,
  isLife: z.boolean().default(false),
  brokerCode: optionalString,
  paymentLink: optionalString,
  bankAccountClp: optionalString,
  bankAccountUsd: optionalString,
  defaultEmail: optionalString,
});

export type TenantCustomCompanyValues = z.infer<
  typeof tenantCustomCompanySchema
>;

export const companyContactSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  lastName: optionalString,
  email: optionalString,
  phone: optionalString,
  celular: optionalString,
  role: optionalString,
  isDefault: z.boolean().default(false),
});

export type CompanyContactValues = z.infer<typeof companyContactSchema>;

// Producto custom o adopción de global.
export const tenantCustomProductSchema = z.object({
  insuranceCompanyId: z.string().min(1, "Compañía requerida"),
  branchTypeId: z.string().min(1, "Ramo requerido"),
  name: z.string().trim().min(1, "Nombre requerido"),
  code: optionalString,
  commissionAffectPct: optionalNumeric,
  commissionExemptPct: optionalNumeric,
  active: z.boolean().default(true),
});

export type TenantCustomProductValues = z.infer<
  typeof tenantCustomProductSchema
>;

export const tenantProductOverrideSchema = z.object({
  commissionAffectPct: optionalNumeric,
  commissionExemptPct: optionalNumeric,
  active: z.boolean().default(true),
});

export type TenantProductOverrideValues = z.infer<
  typeof tenantProductOverrideSchema
>;
