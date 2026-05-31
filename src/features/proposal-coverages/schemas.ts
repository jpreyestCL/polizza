import { z } from "zod";

const optionalString = z.string().trim().default("");
const optionalNumeric = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || !Number.isNaN(Number(v)),
    "Número inválido",
  )
  .default("");

export const itemCoverageSchema = z.object({
  order: optionalNumeric,
  name: z.string().trim().min(1, "Cobertura requerida"),
  polCad: optionalString,
  type: z.enum(["COBERTURA", "ADICIONAL"]),
  isCommercialValue: z.boolean().default(false),
  insuredAmount: optionalNumeric,
  insuredCurrency: z.string().default("UF"),
  affectedByIva: z.boolean().default(false),
  taxRateAffect: optionalNumeric,
  taxRateExempt: optionalNumeric,
  premiumAffect: optionalNumeric,
  premiumExempt: optionalNumeric,
  commissionAffectPct: optionalNumeric,
  commissionExemptPct: optionalNumeric,
  sumsToTotal: z.boolean().default(true),
  manualPremium: z.boolean().default(false),
});

export type ItemCoverageValues = z.infer<typeof itemCoverageSchema>;

/** Fila del grid inline: cobertura + id opcional (vacío = nueva). */
export const itemCoverageRowSchema = itemCoverageSchema.extend({
  id: z.string().optional().default(""),
});
export type ItemCoverageRowValues = z.infer<typeof itemCoverageRowSchema>;

/** Payload del grabado masivo del grid de coberturas. */
export const itemCoveragesBulkSchema = z.object({
  rows: z.array(itemCoverageRowSchema),
});
export type ItemCoveragesBulkValues = z.infer<typeof itemCoveragesBulkSchema>;

/**
 * Cálculo derivado: dada la cobertura, calcula prima neta, IVA, prima bruta
 * y monto comisión. Si `manualPremium` se ignoran las tasas (el usuario ingresa
 * la prima afecta/exenta directamente).
 */
export type CoverageCalc = {
  premiumNet: number; // prima neta = afecta + exenta
  ivaAmount: number;
  premiumGross: number;
  commissionAmount: number;
};

/**
 * Resuelve la prima de un eje (afecta o exenta) según la regla del negocio
 * (obs 5 y 6):
 *  - `manualPremium` (checkbox "cálculo manual"): siempre se usa la prima
 *    ingresada a mano, ignorando la tasa.
 *  - Si hay tasa (> 0): se calcula prima = monto × tasa / 1000 (‰).
 *  - Si NO hay tasa: se permite ingresar la prima manualmente (fallback).
 */
export function resolvePremium(
  manualPremium: boolean,
  taxRateRaw: string,
  premiumRaw: string,
  insured: number,
): number {
  if (manualPremium) return Number(premiumRaw) || 0;
  const tax = Number(taxRateRaw) || 0;
  if (tax > 0) return (insured * tax) / 1000;
  return Number(premiumRaw) || 0;
}

export function computeCoverage(
  values: ItemCoverageValues,
  ivaRate = 0.19,
): CoverageCalc {
  const insured = Number(values.insuredAmount) || 0;
  const premiumAffect = resolvePremium(
    values.manualPremium,
    values.taxRateAffect,
    values.premiumAffect,
    insured,
  );
  const premiumExempt = resolvePremium(
    values.manualPremium,
    values.taxRateExempt,
    values.premiumExempt,
    insured,
  );
  const premiumNet = premiumAffect + premiumExempt;
  const ivaAmount = values.affectedByIva ? premiumAffect * ivaRate : 0;
  const premiumGross = premiumNet + ivaAmount;
  const commAffPct = Number(values.commissionAffectPct) || 0;
  const commExePct = Number(values.commissionExemptPct) || 0;
  const commissionAmount =
    premiumAffect * (commAffPct / 100) + premiumExempt * (commExePct / 100);
  return {
    premiumNet,
    ivaAmount,
    premiumGross,
    commissionAmount,
  };
}
