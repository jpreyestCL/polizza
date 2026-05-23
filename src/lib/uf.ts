/** Utilidades de Unidad de Fomento (UF) y conversión a pesos chilenos. */

/** Convierte un monto en UF a pesos chilenos, redondeado al peso. */
export function ufToClp(ufAmount: number, ufValue: number): number {
  return Math.round(ufAmount * ufValue);
}

/** Formatea un monto en pesos chilenos: "$1.234.567". */
export function formatClp(amount: number): string {
  const formatted = new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return `$${formatted}`;
}

/**
 * Equivalente en pesos de un monto, solo cuando está expresado en UF y hay
 * un valor de UF disponible. Devuelve null en cualquier otro caso.
 */
export function clpEquivalent(
  amount: number,
  currency: string,
  ufValue: number | null,
): string | null {
  if (currency !== "UF" || !ufValue || !Number.isFinite(amount)) {
    return null;
  }
  return formatClp(ufToClp(amount, ufValue));
}
