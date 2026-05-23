import { z } from "zod";

export const CAR_QUOTATION_STATUSES = [
  "BORRADOR",
  "EN_PROCESO",
  "COMPLETADA",
  "ERROR",
] as const;
export type CarQuotationStatusValue = (typeof CAR_QUOTATION_STATUSES)[number];

export const CAR_QUOTATION_STATUS_LABELS: Record<
  CarQuotationStatusValue,
  string
> = {
  BORRADOR: "Borrador",
  EN_PROCESO: "En proceso",
  COMPLETADA: "Completada",
  ERROR: "Con error",
};

export const RESULT_STATUSES = [
  "PENDIENTE",
  "EN_PROCESO",
  "OBTENIDA",
  "ERROR",
] as const;
export type ResultStatusValue = (typeof RESULT_STATUSES)[number];

export const RESULT_STATUS_LABELS: Record<ResultStatusValue, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "Procesando",
  OBTENIDA: "Obtenida",
  ERROR: "Error",
};

export const VEHICLE_CONDITIONS = ["NUEVO", "USADO"] as const;
export type VehicleConditionValue = (typeof VEHICLE_CONDITIONS)[number];
export const VEHICLE_CONDITION_LABELS: Record<VehicleConditionValue, string> = {
  NUEVO: "Nuevo",
  USADO: "Usado",
};

export const VEHICLE_USES = ["PARTICULAR", "COMERCIAL"] as const;
export type VehicleUseValue = (typeof VEHICLE_USES)[number];
export const VEHICLE_USE_LABELS: Record<VehicleUseValue, string> = {
  PARTICULAR: "Particular",
  COMERCIAL: "Comercial",
};

export const CIVIL_LIABILITIES = [
  "UF_500",
  "UF_1000",
  "UF_1500",
  "UF_2000",
] as const;
export type CivilLiabilityValue = (typeof CIVIL_LIABILITIES)[number];
export const CIVIL_LIABILITY_LABELS: Record<CivilLiabilityValue, string> = {
  UF_500: "UF 500",
  UF_1000: "UF 1.000",
  UF_1500: "UF 1.500",
  UF_2000: "UF 2.000",
};
export const CIVIL_LIABILITY_UF: Record<CivilLiabilityValue, number> = {
  UF_500: 500,
  UF_1000: 1000,
  UF_1500: 1500,
  UF_2000: 2000,
};

export const WORKSHOP_TYPES = ["EXCLUSIVIDAD", "MARCA"] as const;
export type WorkshopTypeValue = (typeof WORKSHOP_TYPES)[number];
export const WORKSHOP_TYPE_LABELS: Record<WorkshopTypeValue, string> = {
  EXCLUSIVIDAD: "Exclusividad de taller",
  MARCA: "Taller de marca",
};

/** Opciones por defecto de deducibles (en UF). Vacío = cotizar todos. */
export const DEDUCTIBLE_OPTIONS = [0, 3, 5, 10, 15, 20] as const;

const plateRegex = /^[A-Z0-9-]{4,8}$/i;

export const carQuotationFormSchema = z.object({
  clientId: z.string().min(1, "Selecciona un cliente"),
  patente: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, "Patente inválida")
    .max(8)
    .refine((v) => plateRegex.test(v), "Patente inválida"),
  marca: z.string().trim().max(80).default(""),
  modelo: z.string().trim().max(80).default(""),
  anio: z
    .string()
    .trim()
    .refine((v) => {
      if (v === "") return true;
      const n = Number(v);
      return Number.isInteger(n) && n >= 1900 && n <= new Date().getFullYear() + 1;
    }, "Año inválido")
    .default(""),
  tipoVehiculo: z.string().trim().max(60).default(""),
  motorizacion: z.string().trim().max(60).default(""),
  vehicleCondition: z.enum(VEHICLE_CONDITIONS),
  vehicleUse: z.enum(VEHICLE_USES),
  civilLiability: z.enum(CIVIL_LIABILITIES),
  workshopType: z.enum(WORKSHOP_TYPES),
  /** Deducibles en UF; vacío → cotizar todos. */
  deductibles: z.array(z.number().nonnegative()).default([]),
  insurerKeys: z
    .array(z.string().min(1))
    .min(1, "Selecciona al menos una aseguradora"),
  assignedUserId: z.string().default(""),
  notes: z.string().trim().max(2000).default(""),
});

export type CarQuotationFormValues = z.infer<typeof carQuotationFormSchema>;

export const sendQuotationEmailSchema = z.object({
  template: z.enum(["estandar", "ejecutivo"]).default("estandar"),
  to: z.string().trim().email("Correo de destino inválido"),
  cc: z.string().trim().default(""),
  subject: z.string().trim().min(1, "El asunto es obligatorio").max(200),
  body: z.string().trim().min(1, "Escribe un mensaje").max(8000),
  attachComparativePdf: z.boolean().default(true),
  attachComparativeCsv: z.boolean().default(false),
  /** IDs de CarQuotationResult cuyo PDF adjuntar. */
  attachResultIds: z.array(z.string()).default([]),
});

export type SendQuotationEmailValues = z.infer<typeof sendQuotationEmailSchema>;

export const EMAIL_TEMPLATES = [
  {
    key: "estandar" as const,
    label: "Estándar",
    subject: "Cotización de seguro automotriz",
    body: `Estimado/a,\n\nAdjunto encontrará la(s) cotización(es) solicitada(s) para su vehículo. Quedo atento a sus comentarios.\n\nSaludos cordiales.`,
  },
  {
    key: "ejecutivo" as const,
    label: "Ejecutivo",
    subject: "Resumen comparativo de cotizaciones",
    body: `Estimado/a,\n\nHemos preparado un análisis comparativo de las propuestas recibidas desde cada aseguradora. El detalle se encuentra en los documentos adjuntos.\n\nNo dude en escribir para ampliar cualquier punto.\n\nSaludos.`,
  },
];
