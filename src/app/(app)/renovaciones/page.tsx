import { RefreshCw } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listRenewals } from "@/features/policies/queries";
import { getReportsSnapshot } from "@/features/reports/queries";
import { getCompanies } from "@/features/catalog/queries";
import { RenewalsList } from "@/features/policies/components/renewals-list";
import { PageHeader } from "@/components/page-header";
import { ListSearch } from "@/components/list-search";
import { EmptyState } from "@/components/empty-state";
import { Pager } from "@/components/pager";
import { parsePageParams } from "@/lib/pagination";

type SearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

export default async function RenovacionesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = parsePageParams(sp);
  const { ctx, db } = await requireOrgDb();
  const q = typeof sp?.q === "string" ? sp.q : undefined;
  const [renewalsPage, companies, reports] = await Promise.all([
    listRenewals(ctx, db, page, q),
    getCompanies(db),
    getReportsSnapshot(ctx, db),
  ]);
  const denominator = reports.retention.universe - reports.retention.notRenewable;
  const retention =
    reports.retentionRate == null
      ? null
      : `${new Intl.NumberFormat("es-CL", {
          style: "percent",
          maximumFractionDigits: 1,
        }).format(reports.retentionRate)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Renovaciones"
        description="Pólizas próximas a vencer o ya vencidas que requieren gestión."
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border bg-card px-4 py-3">
          <p className="text-2xl font-semibold">{reports.retention.universe}</p>
          <p className="text-xs text-muted-foreground">Universo del mes</p>
        </article>
        <article className="rounded-xl border bg-card px-4 py-3">
          <p className="text-2xl font-semibold">{retention ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            Retención ({reports.retention.renewed}
            {denominator > 0 ? ` / ${denominator}` : ""})
          </p>
        </article>
        <article className="rounded-xl border bg-card px-4 py-3">
          <p className="text-2xl font-semibold">{reports.retention.notRenewed}</p>
          <p className="text-xs text-muted-foreground">No renovadas del mes</p>
        </article>
      </section>
      <ListSearch placeholder="Buscar por N° de póliza o cliente…" />
      {renewalsPage.rows.length === 0 && !renewalsPage.prevCursor && !q ? (
        <EmptyState
          icon={RefreshCw}
          title="Sin renovaciones pendientes"
          description="Ninguna póliza vigente vence en los próximos 60 días."
        />
      ) : (
        <>
          <RenewalsList
            policies={renewalsPage.rows}
            companies={companies}
          />
          <Pager
            page={renewalsPage}
            baseHref="/renovaciones"
            searchParams={sp}
            itemLabel="renovaciones"
          />
        </>
      )}
    </div>
  );
}
