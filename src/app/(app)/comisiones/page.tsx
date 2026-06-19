import { redirect } from "next/navigation";
import type { PolicyStatus } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { canManageCommissions, canEditCommissionRates } from "@/lib/roles";
import { listCommissions } from "@/features/commissions/queries";
import { getCompanies, getLines } from "@/features/catalog/queries";
import { getOrgMembers } from "@/features/clients/queries";
import { CommissionsNav } from "@/features/commissions/components/commissions-nav";
import { CommissionsTable } from "@/features/commissions/components/commissions-table";
import { PageHeader } from "@/components/page-header";

type SearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

const POLICY_STATUSES = [
  "VIGENTE",
  "VENCIDA",
  "RENOVADA",
  "CANCELADA",
  "ANULADA",
];

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export default async function ComisionesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { ctx, db } = await requireOrgDb();
  if (!canManageCommissions(ctx.role)) redirect("/panel");

  const sp = await searchParams;
  const statusParam = str(sp?.status);
  const pagadoParam = str(sp?.pagado);
  const filters = {
    q: str(sp?.q),
    companyId: str(sp?.companyId),
    lineId: str(sp?.lineId),
    salespersonId: str(sp?.salespersonId),
    status:
      statusParam && POLICY_STATUSES.includes(statusParam)
        ? (statusParam as PolicyStatus)
        : undefined,
    dateFrom: str(sp?.desde),
    dateTo: str(sp?.hasta),
    paidByCompany:
      pagadoParam === "SI" || pagadoParam === "NO"
        ? (pagadoParam as "SI" | "NO")
        : undefined,
  };

  const [result, companies, lines, members] = await Promise.all([
    listCommissions(ctx, db, filters),
    getCompanies(db),
    getLines(db),
    getOrgMembers(ctx.organizationId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comisiones"
        description="Comisiones de la corredora por póliza y liquidación a vendedores."
      />
      <CommissionsNav />
      <CommissionsTable
        rows={result.rows}
        total={result.total}
        truncated={result.truncated}
        companies={companies}
        lines={lines}
        members={members.map((m) => ({ userId: m.userId, name: m.name }))}
        canManage={canManageCommissions(ctx.role)}
        canEditRates={canEditCommissionRates(ctx.role)}
      />
    </div>
  );
}
