/**
 * Lee un deducible escrito como texto y separa monto, porcentaje y mínimo
 * cuando el patrón es claro. El texto original se conserva siempre.
 */

export type ParsedDeductible = {
  text: string | null;
  amount: number | null;
  pct: number | null;
  minimum: number | null;
};

function parseNumber(raw: string): number {
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  // "3.5" ya no tiene punto de miles. Si el original era "1.5" con un solo
  // separador decimal, el reemplazo de puntos lo deja "15". Reintentamos
  // cuando hay un solo separador.
  if (/^\d{1,3}([.,]\d+)$/.test(raw)) {
    return Number(raw.replace(",", "."));
  }
  return Number(normalized);
}

export function parseDeductible(text: string | null | undefined): ParsedDeductible {
  const raw = text?.trim() ?? "";
  if (!raw || raw === "-") {
    return { text: raw || null, amount: null, pct: null, minimum: null };
  }

  const pctWithMinimum = raw.match(
    /(\d+(?:[.,]\d+)?)\s*%[\s\S]*?(?:m[ií]n(?:imo)?\.?|minimo)\s*(?:UF\s*)?(\d+(?:[.,]\d+)?)/i,
  );
  if (pctWithMinimum?.[1] && pctWithMinimum[2]) {
    return {
      text: raw,
      amount: null,
      pct: parseNumber(pctWithMinimum[1]),
      minimum: parseNumber(pctWithMinimum[2]),
    };
  }

  const percentOnly = raw.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (percentOnly?.[1]) {
    return {
      text: raw,
      amount: null,
      pct: parseNumber(percentOnly[1]),
      minimum: null,
    };
  }

  const ufAmount = raw.match(/^UF\s*(\d+(?:[.,]\d+)?)$/i);
  if (ufAmount?.[1]) {
    return {
      text: raw,
      amount: parseNumber(ufAmount[1]),
      pct: null,
      minimum: null,
    };
  }

  const plain = raw.match(/^(\d+(?:[.,]\d+)?)$/);
  if (plain?.[1]) {
    return {
      text: raw,
      amount: parseNumber(plain[1]),
      pct: null,
      minimum: null,
    };
  }

  return { text: raw, amount: null, pct: null, minimum: null };
}
