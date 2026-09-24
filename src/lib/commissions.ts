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
 *
 * Si en la revisión de comisiones se decidió explícitamente (`decision`,
 * Policy.commissionPaid), esa decisión manda: true = se dejó pagada aunque
 * hubiera una diferencia menor; false = se dejó pendiente (p.ej. pago parcial
 * que hay que reclamar). Sin decisión, es automático: pagada cuando la suma de
 * pagos cubre la comisión de la corredora (> 0). Una comisión de 0 nunca se
 * considera pagada automáticamente (no hay nada que liquidarle al vendedor).
 */
export function isPaidByCompany(
  brokerCommission: number,
  totalPaid: number,
  decision?: boolean | null,
): boolean {
  if (decision === true) return true;
  if (decision === false) return false;
  if (brokerCommission <= 0) return false;
  // Tolerancia de 1 peso por redondeos de conversión de moneda.
  return totalPaid + 0.01 >= brokerCommission;
}

/**
 * Margen de error aceptado entre lo que debía pagar la compañía y lo que pagó,
 * en % sobre lo esperado. Cubre diferencias de redondeo y de valor de la UF
 * entre la fecha que usó la compañía y la de referencia.
 */
export const COMMISSION_TOLERANCE_PCT = 1;

export type RateSource = "same" | "entered" | "reference" | "implied" | "none";

export type PaymentEvaluation = {
  /** Tipo de cambio usado para comparar (moneda póliza → moneda del pago). */
  rateUsed: number | null;
  rateSource: RateSource;
  /** Tipo de cambio que usó la compañía: monto pagado / comisión pendiente. */
  impliedRate: number | null;
  /** Monto que debería recibir, en la moneda del pago. */
  expectedAmount: number | null;
  /** Monto pagado convertido a la moneda de la póliza. */
  paidInPolicyCurrency: number | null;
  /** Pagado − esperado, en la moneda del pago (negativo = pagó de menos). */
  difference: number | null;
  /** Diferencia en % sobre lo esperado. */
  differencePct: number | null;
  /** "ok" dentro del margen; "under" pagó de menos; "over" pagó de más. */
  verdict: "ok" | "under" | "over" | null;
};

/**
 * Compara un pago de la compañía contra la comisión pendiente de la póliza.
 *
 * - `due`: comisión pendiente en la moneda de la póliza (p.ej. 2,01 UF).
 * - `paidAmount`: monto que liquida la compañía, en la moneda del pago.
 * - `enteredRate`: tipo de cambio informado por la compañía (moneda póliza →
 *   moneda del pago). Si no lo informa, se compara contra `referenceRate`
 *   (indicador del día) y se entrega el `impliedRate` que usó la compañía.
 * - `sameCurrency`: pago en la misma moneda de la póliza (no hay conversión).
 */
export function evaluateCompanyPayment(input: {
  due: number;
  paidAmount: number | null;
  enteredRate?: number | null;
  referenceRate?: number | null;
  sameCurrency?: boolean;
  tolerancePct?: number;
}): PaymentEvaluation {
  const tolerance = input.tolerancePct ?? COMMISSION_TOLERANCE_PCT;
  const due = input.due > 0 ? input.due : 0;
  const paid =
    input.paidAmount != null && input.paidAmount > 0 ? input.paidAmount : null;

  let rateUsed: number | null;
  let rateSource: RateSource;
  if (input.sameCurrency) {
    rateUsed = 1;
    rateSource = "same";
  } else if (input.enteredRate && input.enteredRate > 0) {
    rateUsed = input.enteredRate;
    rateSource = "entered";
  } else if (input.referenceRate && input.referenceRate > 0) {
    rateUsed = input.referenceRate;
    rateSource = "reference";
  } else if (paid != null && due > 0) {
    rateUsed = paid / due;
    rateSource = "implied";
  } else {
    rateUsed = null;
    rateSource = "none";
  }

  const impliedRate =
    !input.sameCurrency && paid != null && due > 0
      ? Math.round((paid / due) * 10000) / 10000
      : null;
  const expectedAmount = rateUsed != null ? round2(due * rateUsed) : null;
  const paidInPolicyCurrency =
    paid != null && rateUsed ? Math.round((paid / rateUsed) * 10000) / 10000 : null;

  if (paid == null || expectedAmount == null) {
    return {
      rateUsed,
      rateSource,
      impliedRate,
      expectedAmount,
      paidInPolicyCurrency,
      difference: null,
      differencePct: null,
      verdict: null,
    };
  }

  const difference = round2(paid - expectedAmount);
  const differencePct =
    expectedAmount > 0 ? round2((difference / expectedAmount) * 100) : null;
  let verdict: PaymentEvaluation["verdict"];
  if (differencePct == null) verdict = difference > 0 ? "over" : "ok";
  else if (Math.abs(differencePct) <= tolerance) verdict = "ok";
  else verdict = difference < 0 ? "under" : "over";

  return {
    rateUsed,
    rateSource,
    impliedRate,
    expectedAmount,
    paidInPolicyCurrency,
    difference,
    differencePct,
    verdict,
  };
}
