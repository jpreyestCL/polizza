import { RefreshCw } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listRenewals } from "@/features/policies/queries";
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
  const [renewalsPage, companies] = await Promise.all([
    listRenewals(ctx, db, page, q),
    getCompanies(db),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Renovaciones"
        description="Pólizas próximas a vencer o ya vencidas que requieren gestión."
      />
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
