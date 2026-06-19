/**
 * Cálculo de comisiones. Funciones puras (sin Prisma) para poder testearlas
 * y reusarlas en queries/actions y UI.
 *
 * Dos comisiones distintas:
 *  - Comisión de la corredora: lo que la compañía le paga a la corredora por la
 *    póliza. Vive en Policy.commissionAmount (o se deriva de prima × %).
 *  - Comisión del vendedor: un % de la comisión de la corredora. Tasa default
 *    por vendedor (SalespersonCommissionRate.defaultPct), con override por
 *    póliza (Policy.salesCommissionPct).
 */

/** Redondea a 2 decimales evitando errores de coma flotante. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Comisión de la corredora para una póliza. Usa commissionAmount si está
 * definido; si no, lo deriva de prima neta × (commissionPercent / 100).
 * Devuelve 0 si no hay datos suficientes.
 */
export function brokerCommissionOf(policy: {
  commissionAmount?: number | null;
  premiumNet?: number | null;
  commissionPercent?: number | null;
}): number {
  if (policy.commissionAmount != null && !Number.isNaN(policy.commissionAmount)) {
    return round2(policy.commissionAmount);
  }
  const premium = policy.premiumNet ?? 0;
  const pct = policy.commissionPercent ?? 0;
  if (!premium || !pct) return 0;
  return round2((premium * pct) / 100);
}

/**
 * Tasa de comisión del vendedor aplicable a una póliza: el override de la
 * póliza si existe (incluido 0, que es un acuerdo válido), o la tasa default
 * del vendedor. Devuelve null si no hay ninguna definida.
 */
export function appliedSellerPct(
  policyOverridePct: number | null | undefined,
  salespersonDefaultPct: number | null | undefined,
): number | null {
  if (policyOverridePct != null && !Number.isNaN(policyOverridePct)) {
    return policyOverridePct;
  }
  if (salespersonDefaultPct != null && !Number.isNaN(salespersonDefaultPct)) {
    return salespersonDefaultPct;
  }
  return null;
}

/**
 * Pago al vendedor = comisión corredora × (tasa aplicada / 100).
 * Devuelve 0 si no hay tasa aplicable.
 */
export function sellerPayout(
  brokerCommission: number,
  appliedPct: number | null,
): number {
  if (appliedPct == null) return 0;
  return round2((brokerCommission * appliedPct) / 100);
}

export type CompanyPayment = {
  amount: number;
  currency: string;
  /**
   * Valor de 1 unidad de la moneda de la PÓLIZA expresado en la moneda del
   * PAGO (p.ej. póliza en UF, pago en CLP → factor = valor de la UF, ~38000).
   * Solo aplica cuando la moneda del pago ≠ moneda de la póliza.
   */
  exchangeFactor?: number | null;
};

/**
 * Convierte el monto de un pago a la moneda de la póliza, para poder
 * compararlo con la comisión de la corredora (que está en moneda de póliza).
 * - Si el pago está en la misma moneda que la póliza: monto tal cual.
 * - Si difiere y hay factor (> 0): monto / factor.
 * - Si difiere y no hay factor: no se puede convertir → 0 (no suma, evita
 *   falsos positivos de "pagado").
 */
export function paymentInPolicyCurrency(
  payment: CompanyPayment,
  policyCurrency: string,
): number {
  if (payment.currency === policyCurrency) return round2(payment.amount ?? 0);
  const factor = payment.exchangeFactor ?? 0;
  if (!factor || factor <= 0) return 0;
  return round2((payment.amount ?? 0) / factor);
}

/**
 * Suma de los pagos recibidos de la compañía, todos convertidos a la moneda de
 * la póliza para comparar contra la comisión de la corredora.
 */
export function totalCompanyPaid(
  payments: CompanyPayment[],
  policyCurrency: string,
): number {
  return round2(
    payments.reduce(
      (acc, p) => acc + paymentInPolicyCurrency(p, policyCurrency),
      0,
    ),
  );
}

/**
 * ¿La compañía ya pagó la comisión de la corredora por esta póliza?
 * True cuando la suma de pagos cubre la comisión de la corredora (> 0).
 * Una comisión de corredora de 0 nunca se considera pagada (no hay nada que
 * liquidarle al vendedor).
 */
export function isPaidByCompany(
  brokerCommission: number,
  totalPaid: number,
): boolean {
  if (brokerCommission <= 0) return false;
  // Tolerancia de 1 peso por redondeos de conversión de moneda.
  return totalPaid + 0.01 >= brokerCommission;
}
