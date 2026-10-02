/**
 * Lectura local del texto de una póliza, un endoso o una cotización.
 * No llama a un modelo externo. Si falta un dato, queda para revisar
 * y nunca bloquea la emisión.
 */

export type ExtractionDraft = {
  policyNumber: string | null;
  premiumNet: number | null;
  startDate: string | null;
  endDate: string | null;
  evidence: { field: string; snippet: string }[];
  status: "EXTRACTED" | "NEEDS_REVIEW";
};

function snippetAround(text: string, index: number): string {
  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + 48);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function parseAmount(raw: string): number | null {
  const compact = raw.trim().replace(/\s/g, "");
  if (!compact) return null;
  const lastDot = compact.lastIndexOf(".");
  const lastComma = compact.lastIndexOf(",");
  let normalized = compact;
  if (lastDot >= 0 && lastComma >= 0) {
    normalized =
      lastComma > lastDot
        ? compact.replace(/\./g, "").replace(",", ".")
        : compact.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = compact.replace(",", ".");
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function extractPolicyText(text: string): ExtractionDraft {
  const evidence: { field: string; snippet: string }[] = [];
  const numberMatch = text.match(
    /p[oó]liza\s*(?:n[°ºo.]*)?\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/]{2,})/i,
  );
  const premiumMatch = text.match(
    /prima\s+neta\s*[:\s]*\$?\s*([0-9][0-9.]*,?[0-9]*)/i,
  );
  const startMatch = text.match(
    /(?:desde|inicio|vigencia)\s*[:\s]*(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}-\d{2}-\d{2})/i,
  );
  const endMatch = text.match(
    /(?:hasta|t[eé]rmino|fin)\s*[:\s]*(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}-\d{2}-\d{2})/i,
  );

  if (numberMatch?.index != null) {
    evidence.push({
      field: "policyNumber",
      snippet: snippetAround(text, numberMatch.index),
    });
  }
  if (premiumMatch?.index != null) {
    evidence.push({
      field: "premiumNet",
      snippet: snippetAround(text, premiumMatch.index),
    });
  }
  if (startMatch?.index != null) {
    evidence.push({
      field: "startDate",
      snippet: snippetAround(text, startMatch.index),
    });
  }
  if (endMatch?.index != null) {
    evidence.push({
      field: "endDate",
      snippet: snippetAround(text, endMatch.index),
    });
  }

  const policyNumber = numberMatch?.[1] ?? null;
  const premiumNet = premiumMatch ? parseAmount(premiumMatch[1]) : null;
  const startDate = startMatch?.[1] ?? null;
  const endDate = endMatch?.[1] ?? null;
  const complete = Boolean(policyNumber && premiumNet != null && startDate && endDate);
  return {
    policyNumber,
    premiumNet,
    startDate,
    endDate,
    evidence,
    status: complete ? "EXTRACTED" : "NEEDS_REVIEW",
  };
}
