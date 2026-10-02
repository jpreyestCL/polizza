export type CsvTable = { headers: string[]; rows: string[][] };

export function toCsv(table: CsvTable): string {
  const lines = [
    table.headers.join(";"),
    ...table.rows.map((row) =>
      row
        .map((cell) => {
          const value = cell ?? "";
          if (/[;"\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
          return value;
        })
        .join(";"),
    ),
  ];
  return lines.join("\n");
}

export type ReportExportInput = {
  portfolioCount: number;
  retentionRate: string;
  production: { currency: string; movementType: string; count: number; net: number; gross: number; commission: number }[];
  aging: { policyNumber: string; clientName: string; currency: string; amount: number; daysLate: number; bucket: string }[];
  claimsOpen: number;
  catalogValue: string;
};

const KNOWN = new Set([
  "R-01",
  "R-02",
  "R-03",
  "R-04",
  "R-05",
  "R-06",
  "R-07",
  "R-08",
  "R-09",
  "R-10",
  "R-11",
  "R-12",
]);

export function reportTable(code: string, input: ReportExportInput): CsvTable | null {
  if (!KNOWN.has(code)) return null;
  if (code === "R-01") {
    return {
      headers: ["moneda", "movimiento", "cantidad", "neta", "bruta", "comision"],
      rows: input.production.map((row) => [
        row.currency,
        row.movementType,
        String(row.count),
        String(row.net),
        String(row.gross),
        String(row.commission),
      ]),
    };
  }
  if (code === "R-04" || code === "R-05") {
    return {
      headers: ["poliza", "cliente", "moneda", "monto", "dias", "tramo"],
      rows: input.aging.map((row) => [
        row.policyNumber,
        row.clientName,
        row.currency,
        String(row.amount),
        String(row.daysLate),
        row.bucket,
      ]),
    };
  }
  return {
    headers: ["informe", "valor"],
    rows: [[code, code === "R-02" ? String(input.portfolioCount) : code === "R-03" ? input.retentionRate : code === "R-08" ? String(input.claimsOpen) : input.catalogValue]],
  };
}
