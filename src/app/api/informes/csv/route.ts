import { requireOrgDb } from "@/server/context";
import {
  getReportsSnapshot,
  reportFiltersFrom,
} from "@/features/reports/queries";
import { hasPermission } from "@/lib/factory-roles";
import { reportTable, toCsv } from "@/lib/domain/report-csv";

export async function GET(request: Request) {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "reports.export")) {
    return new Response("PERMISSION_DENIED", { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const code = params.get("codigo") ?? "";
  const data = await getReportsSnapshot(ctx, db, reportFiltersFrom(params));
  const card = data.catalog.find((report) => report.id === code);
  const table = reportTable(code, {
    portfolioCount: data.portfolioCount,
    retentionRate: data.retentionRate == null ? "" : String(data.retentionRate),
    production: data.production,
    aging: data.agingRows.map((row) => ({
      policyNumber: row.policyNumber,
      clientName: row.clientName,
      currency: row.currency,
      amount: row.amount,
      daysLate: row.daysLate,
      bucket: row.bucket,
    })),
    claimsOpen: data.claimsOpen,
    catalogValue: card?.value ?? "",
  });
  if (!table) return new Response("VALIDATION_ERROR", { status: 422 });
  return new Response(`\uFEFF${toCsv(table)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${code}.csv"`,
    },
  });
}
