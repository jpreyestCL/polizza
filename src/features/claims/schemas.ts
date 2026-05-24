import { z } from "zod";

export const CLAIM_STATUSES = [
  "REPORTADO",
  "INGRESADO_COMPANIA",
  "EN_EVALUACION",
  "APROBADO",
  "RECHAZADO",
  "PAGADO",
  "CERRADO",
] as const;

export type ClaimStatusValue = (typeof CLAIM_STATUSES)[number];

export const CLAIM_STATUS_LABELS: Record<ClaimStatusValue, string> = {
  REPORTADO: "Reportado",
  INGRESADO_COMPANIA: "Ingresado en compañía",
  EN_EVALUACION: "En evaluación",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  PAGADO: "Pagado",
  CERRADO: "Cerrado",
};

export const CLAIM_ENTRY_PARTIES = ["COMPANIA", "CORREDOR"] as const;
export type ClaimEntryPartyValue = (typeof CLAIM_ENTRY_PARTIES)[number];
export const CLAIM_ENTRY_PARTY_LABELS: Record<ClaimEntryPartyValue, string> = {
  COMPANIA: "Compañía",
  CORREDOR: "Corredor",
};

export const CLAIM_ENTRY_CHANNELS = [
  "TELEFONO",
  "EMAIL",
  "WEB",
  "CALL_CENTER",
  "OTRO",
] as const;
export type ClaimEntryChannelValue = (typeof CLAIM_ENTRY_CHANNELS)[number];
export const CLAIM_ENTRY_CHANNEL_LABELS: Record<
  ClaimEntryChannelValue,
  string
> = {
  TELEFONO: "Teléfono",
  EMAIL: "Email",
  WEB: "Web",
  CALL_CENTER: "Call center",
  OTRO: "Otro",
};

export const CLAIM_LOSS_TYPES = ["PARCIAL", "TOTAL"] as const;
export type ClaimLossTypeValue = (typeof CLAIM_LOSS_TYPES)[number];
export const CLAIM_LOSS_TYPE_LABELS: Record<ClaimLossTypeValue, string> = {
  PARCIAL: "Parcial",
  TOTAL: "Total",
};

/**
 * Ramos que disparan el panel extendido de vehículos (chofer, alcoholemia,
 * deducible inteligente, terceros). El resto cae al panel "Ramos varios".
 */
export const VEHICLE_BRANCH_KEYS = new Set([
  "vehiculos",
  "vehiculos_motorizados",
  "soap",
  "equipo_movil_individualizado",
]);

export function isVehicleBranch(branchKey: string | null | undefined): boolean {
  if (!branchKey) return false;
  return VEHICLE_BRANCH_KEYS.has(branchKey);
}

const optionalAmount = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0),
    "Monto inválido",
  )
  .default("");

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal("")]).default("");

const optionalBool = z.enum(["", "true", "false"]).default("");

const optionalIntString = z
  .string()
  .trim()
  .refine((value) => value === "" || /^[0-9]+$/.test(value), "Solo dígitos")
  .default("");

/** Paso 1: crear el denuncio una vez seleccionados póliza + item. */
export const claimIntakeSchema = z.object({
  clientId: z.string().min(1),
  policyId: z.string().min(1),
  policyItemId: z.string().default(""),
  proposalItemId: z.string().default(""),
  branchTypeId: z.string().default(""),
  description: z
    .string()
    .trim()
    .min(1, "Describe brevemente el siniestro")
    .max(2000),
});
export type ClaimIntakeValues = z.infer<typeof claimIntakeSchema>;

/** Edición de los datos del denuncio (lo que aparece en la ficha). */
export const claimDetailsSchema = z.object({
  // Ingreso del denuncio
  entryParty: optionalEnum(CLAIM_ENTRY_PARTIES),
  entryChannel: optionalEnum(CLAIM_ENTRY_CHANNELS),
  reportedAtBroker: z.string().default(""),

  // Denunciante
  reporterRut: z.string().trim().max(20).default(""),
  reporterFirstName: z.string().trim().max(120).default(""),
  reporterLastName: z.string().trim().max(120).default(""),
  reporterPhone: z.string().trim().max(40).default(""),
  reporterEmail: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Email inválido",
    )
    .default(""),

  // Datos del siniestro (comunes)
  occurredAt: z.string().default(""),
  occurredAtTime: z.string().default(""),
  mainCoverageAffected: z.string().trim().max(200).default(""),
  policeReportDate: z.string().default(""),
  policeStation: z.string().trim().max(200).default(""),
  policeReportFolio: z.string().trim().max(100).default(""),
  incidentCause: z.string().trim().max(200).default(""),
  incidentAddress: z.string().trim().max(200).default(""),
  incidentCommune: z.string().trim().max(120).default(""),
  incidentCity: z.string().trim().max(120).default(""),
  incidentNarrative: z.string().trim().max(4000).default(""),

  // Específicos de vehículos
  lossType: optionalEnum(CLAIM_LOSS_TYPES),
  smartDeductible: optionalBool,
  hasAlcoholTest: optionalBool,
  driverAtFault: optionalBool,
  driverFirstName: z.string().trim().max(120).default(""),
  driverLastName: z.string().trim().max(120).default(""),
  driverRut: z.string().trim().max(20).default(""),
  driverAge: optionalIntString,

  // Estado liquidación
  estimatedAmount: optionalAmount,
  settledAmount: optionalAmount,
  currency: z.enum(["UF", "CLP", "USD", "USD_OBS", "EUR", "UD"]),
  assignedUserId: z.string().default(""),
  description: z.string().trim().min(1).max(2000),
});
export type ClaimDetailsValues = z.infer<typeof claimDetailsSchema>;

export const claimCompanyInfoSchema = z.object({
  companyClaimNumber: z.string().trim().max(80).default(""),
  liquidatorName: z.string().trim().max(160).default(""),
  filedAtCompanyAt: z.string().default(""),
});
export type ClaimCompanyInfoValues = z.infer<typeof claimCompanyInfoSchema>;

export const claimStatusChangeSchema = z.object({
  status: z.enum(CLAIM_STATUSES),
  note: z.string().trim().max(1000).default(""),
});
export type ClaimStatusChangeValues = z.infer<typeof claimStatusChangeSchema>;

export const claimThirdPartySchema = z.object({
  involvesVehicle: z.boolean().default(true),
  firstName: z.string().trim().max(120).default(""),
  lastName: z.string().trim().max(120).default(""),
  rut: z.string().trim().max(20).default(""),
  phone: z.string().trim().max(40).default(""),
  email: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Email inválido",
    )
    .default(""),
  vehicleType: z.string().trim().max(60).default(""),
  vehicleBrand: z.string().trim().max(60).default(""),
  vehicleModel: z.string().trim().max(60).default(""),
  vehicleYear: optionalIntString,
  plate: z.string().trim().max(20).default(""),
  engineNumber: z.string().trim().max(40).default(""),
  chassisNumber: z.string().trim().max(40).default(""),
  hasInsurance: optionalBool,
  insuranceCompany: z.string().trim().max(160).default(""),
  policyNumber: z.string().trim().max(80).default(""),
  atFault: optionalBool,
  damagedGoodsDescription: z.string().trim().max(2000).default(""),
});
export type ClaimThirdPartyValues = z.infer<typeof claimThirdPartySchema>;

export const claimNoteSchema = z.object({
  message: z.string().trim().min(1, "Escribe una nota").max(2000),
});
export type ClaimNoteValues = z.infer<typeof claimNoteSchema>;
