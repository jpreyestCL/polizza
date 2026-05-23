import { RefreshCw } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listRenewals } from "@/features/policies/queries";
import { getCompanies } from "@/features/catalog/queries";
import { RenewalsList } from "@/features/policies/components/renewals-list";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default async function RenovacionesPage() {
  const { ctx, db } = await requireOrgDb();
  const [renewals, companies] = await Promise.all([
    listRenewals(ctx, db),
    getCompanies(db),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Renovaciones"
        description="Pólizas próximas a vencer o ya vencidas que requieren gestión."
      />
      {renewals.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="Sin renovaciones pendientes"
          description="Ninguna póliza vigente vence en los próximos 60 días."
        />
      ) : (
        <RenewalsList policies={renewals} companies={companies} />
      )}
    </div>
  );
}
