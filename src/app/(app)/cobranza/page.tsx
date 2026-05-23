import { Wallet } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listAllInstallments } from "@/features/billing/queries";
import { CobranzaOverview } from "@/features/billing/components/cobranza-overview";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default async function CobranzaPage() {
  const { ctx, db } = await requireOrgDb();
  const installments = await listAllInstallments(ctx, db);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cobranza"
        description="Cuotas de pago de la cartera de pólizas."
      />
      {installments.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Sin cuotas registradas"
          description="Genera un plan de cuotas desde la pestaña Cobranza de una póliza."
        />
      ) : (
        <CobranzaOverview installments={installments} />
      )}
    </div>
  );
}
