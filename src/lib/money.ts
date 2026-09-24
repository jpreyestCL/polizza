/** Monedas soportadas por el sistema.
 * UD = Unidad de Desarrollo. USD_OBS = Dólar Observado. */
export const CURRENCIES = [
  "UF",
  "CLP",
  "USD",
  "USD_OBS",
  "EUR",
  "UD",
] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

const DECIMALS: Record<CurrencyCode, number> = {
  UF: 2,
  CLP: 0,
  USD: 2,
  USD_OBS: 2,
  EUR: 2,
  UD: 2,
};

const SYMBOLS: Record<CurrencyCode, string> = {
  UF: "UF",
  CLP: "$",
  USD: "US$",
  USD_OBS: "US$",
  EUR: "€",
  UD: "UD",
};

const LABELS: Record<CurrencyCode, string> = {
  UF: "UF",
  CLP: "Peso",
  USD: "Dólar",
  USD_OBS: "Dólar Observado",
  EUR: "Euro",
  UD: "UD",
};

export function currencyLabel(c: CurrencyCode | string): string {
  return LABELS[c as CurrencyCode] ?? c;
}

/** Formatea un monto con la cantidad de decimales propia de la moneda. */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: CurrencyCode = "UF",
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(value)) return "—";
  const decimals = DECIMALS[currency] ?? 2;
  const formatted = new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return currency === "CLP"
    ? `${SYMBOLS[currency]}${formatted}`
    : `${SYMBOLS[currency]} ${formatted}`;
}

export function isCurrency(value: string): value is CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(value);
}

/**
 * Interpreta un número escrito a la chilena o con punto decimal:
 *  - "82.274" → 82274 (punto como separador de miles)
 *  - "40.950,75" → 40950.75
 *  - "40950.75" / "40950,75" → 40950.75
 * Devuelve null si el texto está vacío o no es un número.
 */
export function parseLocaleNumber(input: string | null | undefined): number | null {
  if (input == null) return null;
  let text = String(input).trim().replace(/\s|\$/g, "");
  if (!text) return null;
  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}
