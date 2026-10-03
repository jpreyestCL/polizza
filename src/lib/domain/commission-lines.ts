export type CommissionPasteLine = {
  policyNumber: string;
  amount: number;
};

const POLICY_HEADER = /p[oó]liza|policy|n[uú]mero|nro|folio/i;
const STRONG_POLICY_HEADER = /p[oó]liza|policy/i;
const NOT_POLICY_HEADER = /endoso|cuota|[ií]tem|l[ií]nea|fila|row|^#$|^n[°º]$/i;
const COMMISSION_HEADER = /comisi[oó]n|commission/i;
const AMOUNT_HEADER = /monto|amount|valor|importe|total/i;
const RATE_HEADER = /%|tasa|porc|rate/i;

/**
 * Columna de póliza: primero la que dice "póliza", luego "número"/"folio",
 * nunca la de endoso, cuota o correlativo de fila.
 */
function findPolicyColumn(cells: string[]): number {
  const candidates = cells
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => POLICY_HEADER.test(cell));
  const strong = candidates.find(
    ({ cell }) => STRONG_POLICY_HEADER.test(cell) && !/endoso/i.test(cell),
  );
  if (strong) return strong.index;
  return candidates.find(({ cell }) => !NOT_POLICY_HEADER.test(cell))?.index ?? -1;
}

/** Columna del monto de comisión, nunca la de tasa o porcentaje. */
function findAmountColumn(cells: string[], policyCol: number): number {
  const usable = (cell: string, index: number) =>
    index !== policyCol && !RATE_HEADER.test(cell);
  const commission = cells.findIndex(
    (cell, index) => usable(cell, index) && COMMISSION_HEADER.test(cell),
  );
  if (commission >= 0) return commission;
  return cells.findIndex((cell, index) => usable(cell, index) && AMOUNT_HEADER.test(cell));
}

/** Corta una fila respetando comillas dobles ("a;b" es una celda). */
export function splitCsvRow(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      out.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  out.push(cell.trim());
  return out;
}

/**
 * Monto con separadores chilenos o anglosajones: "1.234,56", "1,234.56",
 * "$ 12.345", "12,5". Con un solo punto y tres decimales, en pesos es miles.
 */
export function parseStatementAmount(
  raw: string,
  currency = "UF",
): number | null {
  let value = raw.replace(/[^\d.,-]/g, "");
  if (!value || !/\d/.test(value)) return null;
  const lastDot = value.lastIndexOf(".");
  const lastComma = value.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    value = value.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    const parts = value.split(",");
    value =
      parts.length > 2 ? parts.join("") : value.replace(",", ".");
  } else if (lastDot >= 0) {
    const parts = value.split(".");
    const looksThousands =
      parts.length > 2 ||
      (currency.toUpperCase() === "CLP" && parts[1]?.length === 3);
    if (looksThousands) value = parts.join("");
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function detectDelimiter(header: string): string | null {
  for (const mark of [";", "\t", ","]) {
    if (header.includes(mark)) return mark;
  }
  return null;
}

/**
 * Lee la liquidación de la compañía. Con encabezado, busca las columnas de
 * póliza y de comisión (o monto) por nombre, en cualquier orden, y respeta
 * comillas. Sin encabezado, cada línea es número de póliza y monto separados
 * por espacio, tabulación o punto y coma.
 */
export function parseCommissionLines(
  raw: string,
  currency = "UF",
): CommissionPasteLine[] {
  const rows = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (rows.length === 0) return [];

  const parsed: CommissionPasteLine[] = [];
  const push = (policyNumber: string, amountRaw: string) => {
    const amount = parseStatementAmount(amountRaw, currency);
    const number = policyNumber.trim();
    // Los montos negativos (reversas de la compañía) se guardan; el calce no
    // los asigna y la pantalla los informa como ajustes.
    if (!number || amount == null || amount === 0) return;
    parsed.push({ policyNumber: number, amount });
  };

  let index = 0;
  while (index < rows.length) {
    const line = rows[index];
    const delimiter = detectDelimiter(line);
    const headerCells = delimiter ? splitCsvRow(line, delimiter) : line.split(/\s+/);
    const policyCol = findPolicyColumn(headerCells);
    const amountCol = findAmountColumn(headerCells, policyCol);
    const isHeader =
      policyCol >= 0 &&
      amountCol >= 0 &&
      parseStatementAmount(headerCells[amountCol] ?? "", currency) == null;
    if (!isHeader) break;
    index += 1;
    // Las filas que siguen al encabezado usan sus columnas, hasta otro encabezado.
    while (index < rows.length) {
      const row = rows[index];
      const cells = delimiter ? splitCsvRow(row, delimiter) : row.split(/\s+/);
      const nextIsHeader =
        cells.some((cell) => POLICY_HEADER.test(cell)) &&
        parseStatementAmount(cells[amountCol] ?? "", currency) == null;
      if (nextIsHeader) break;
      push(cells[policyCol] ?? "", cells[amountCol] ?? "");
      index += 1;
    }
  }

  for (; index < rows.length; index += 1) {
    const line = rows[index];
    const byMark = line.split(/[;\t]/).map((part) => part.trim()).filter(Boolean);
    const cells = byMark.length >= 2 ? byMark : line.split(/\s+/);
    push(cells[0] ?? "", cells[1] ?? "");
  }
  return parsed;
}
