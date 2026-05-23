import { requireOrgDb } from "@/server/context";
import { listHoldings } from "@/features/holdings/queries";
import { HoldingsList } from "@/features/holdings/components/holdings-list";
import { PageHeader } from "@/components/page-header";

export default async function HoldingsPage() {
  const { db } = await requireOrgDb();
  const holdings = await listHoldings(db);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Holdings"
        description="Grupos de clientes relacionados entre sí."
      />
      <HoldingsList holdings={holdings} />
    </div>
  );
}
