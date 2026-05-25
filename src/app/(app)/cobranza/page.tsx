import { Wallet } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listAllInstallments } from "@/features/billing/queries";
import { CobranzaOverview } from "@/features/billing/components/cobranza-overview";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Pager } from "@/components/pager";
import { parsePageParams } from "@/lib/pagination";

type SearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

export default async function CobranzaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = parsePageParams(sp);
  const { ctx, db } = await requireOrgDb();
  const installmentsPage = await listAllInstallments(ctx, db, page);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cobranza"
        description="Cuotas de pago de la cartera de pólizas."
      />
      {installmentsPage.rows.length === 0 && !installmentsPage.prevCursor ? (
        <EmptyState
          icon={Wallet}
          title="Sin cuotas registradas"
          description="Genera un plan de cuotas desde la pestaña Cobranza de una póliza."
        />
      ) : (
        <>
          <CobranzaOverview installments={installmentsPage.rows} />
          <Pager
            page={installmentsPage}
            baseHref="/cobranza"
            searchParams={sp}
            itemLabel="cuotas"
          />
        </>
      )}
    </div>
  );
}
