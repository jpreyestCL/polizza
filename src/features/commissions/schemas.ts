import { z } from "zod";
import { CURRENCIES } from "@/lib/money";

const currencyEnum = z.enum(
  CURRENCIES as unknown as [string, ...string[]],
);

const amountString = z
  .string()
  .trim()
  .refine(
    (value) => !Number.isNaN(Number(value)) && Number(value) > 0,
    "Ingresa un monto válido",
  );

const pctString = z
  .string()
  .trim()
  .refine((value) => {
    const n = Number(value);
    return !Number.isNaN(n) && n >= 0 && n <= 100;
  }, "Porcentaje entre 0 y 100");

const optionalString = z.string().trim().default("");

const dateString = z
  .string()
  .min(1, "Fecha requerida")
  .refine(
    (value) => !Number.isNaN(new Date(value).getTime()),
    "Fecha inválida",
  );

const optionalPositive = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" || (!Number.isNaN(Number(value)) && Number(value) > 0),
    "Ingresa un valor mayor a 0",
  )
  .default("");

const optionalNonNegative = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0),
    "Ingresa un valor válido",
  )
  .default("");

/**
 * Qué hacer con la comisión al registrar el pago:
 *  - PAID: dejarla pagada por la compañía (aunque haya una diferencia).
 *  - PENDING: registrar el pago pero dejar la comisión pendiente (p.ej. pagó
 *    de menos y hay que reclamar el saldo).
 */
export const PAYMENT_DECISIONS = ["PAID", "PENDING"] as const;
export type PaymentDecision = (typeof PAYMENT_DECISIONS)[number];

/** Registrar un pago de la compañía por la comisión de una póliza. */
export const companyPaymentSchema = z.object({
  policyId: z.string().min(1, "Póliza requerida"),
  paymentDate: dateString,
  amount: amountString,
  currency: currencyEnum.default("CLP"),
  invoiceNumber: optionalString,
  invoiceDate: optionalString,
  // Tipo de cambio moneda póliza → moneda del pago (el informado por la
  // compañía o, si no lo informa, el implícito / de referencia).
  exchangeFactor: optionalPositive,
  notes: optionalString,
  decision: z.enum(PAYMENT_DECISIONS).default("PAID"),
});
export type CompanyPaymentValues = z.infer<typeof companyPaymentSchema>;

/**
 * Corrección de la comisión de la póliza desde la revisión de comisiones
 * (prima neta, % y/o monto fijo). Monto vacío = se deriva de prima × %.
 */
export const policyCommissionSchema = z.object({
  premiumNet: optionalNonNegative,
  commissionPercent: z
    .string()
    .trim()
    .refine((value) => {
      if (value === "") return true;
      const n = Number(value);
      return !Number.isNaN(n) && n >= 0 && n <= 100;
    }, "Porcentaje entre 0 y 100")
    .default(""),
  commissionAmount: optionalNonNegative,
});
export type PolicyCommissionValues = z.infer<typeof policyCommissionSchema>;

/** Tasa default de comisión de un vendedor (admin). */
export const salespersonRateSchema = z.object({
  userId: z.string().min(1, "Selecciona un vendedor"),
  defaultPct: pctString,
  isActive: z.boolean().default(true),
});
export type SalespersonRateValues = z.infer<typeof salespersonRateSchema>;

/** Override de vendedor / tasa a nivel póliza (admin). */
export const policySalesCommissionSchema = z.object({
  salespersonId: optionalString,
  // Vacío = usar la tasa default del vendedor (sin override).
  salesCommissionPct: z
    .string()
    .trim()
    .refine((value) => {
      if (value === "") return true;
      const n = Number(value);
      return !Number.isNaN(n) && n >= 0 && n <= 100;
    }, "Porcentaje entre 0 y 100")
    .default(""),
});
export type PolicySalesCommissionValues = z.infer<
  typeof policySalesCommissionSchema
>;

/** Generar una liquidación a partir de pólizas seleccionadas. */
export const generateSettlementSchema = z.object({
  salespersonId: z.string().min(1, "Selecciona un vendedor"),
  policyIds: z.array(z.string().min(1)).min(1, "Selecciona al menos una póliza"),
  notes: optionalString,
});
export type GenerateSettlementValues = z.infer<typeof generateSettlementSchema>;

export const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PAGADA: "Pagada",
};
