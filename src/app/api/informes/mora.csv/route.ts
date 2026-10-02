import { requireOrgDb } from "@/server/context";
import { getReportsSnapshot } from "@/features/reports/queries";

function csvCell(value: string): string {
  if (/[;"\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function formatDay(date: Date): string {
  const [year, month, day] = date.toISOString().slice(0, 10).split("-");
  return `${day}-${month}-${year}`;
}

export async function GET() {
  const { ctx, db } = await requireOrgDb();
  const data = await getReportsSnapshot(ctx, db);
  const lines = [
    "poliza;cliente;moneda;monto;vencimiento;dias;tramo",
    ...data.agingRows.map((row) =>
      [
        row.policyNumber,
        row.clientName,
        row.currency,
        String(row.amount).replace(".", ","),
        formatDay(row.dueDate),
        String(row.daysLate),
        row.bucket,
      ]
        .map(csvCell)
        .join(";"),
    ),
  ];
  return new Response(`\uFEFF${lines.join("\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mora.csv"',
    },
  });
}
