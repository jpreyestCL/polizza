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
import { bulkRenewMonthAction } from "@/features/policies/actions";
import { hasPermission } from "@/lib/factory-roles";

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
  const aviso = typeof sp?.aviso === "string" ? sp.aviso : null;
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
      {aviso ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">{aviso}</p>
      ) : null}
      {hasPermission(ctx.role, "renewals.bulk") ? (
        <form action={bulkRenewMonthAction} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
            Renovar las vigentes que terminan este mes (máximo 20)
            <input name="reason" required minLength={10} className="rounded-md border bg-background px-2 py-1.5" placeholder="Motivo de la renovación masiva" />
          </label>
          <button type="submit" className="rounded-md border px-3 py-2 text-sm">Renovar el mes</button>
        </form>
      ) : null}
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
