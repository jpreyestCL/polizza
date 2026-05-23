import { requireOrgDb } from "@/server/context";
import { listBrokers } from "@/features/brokers/queries";
import { BrokersPanel } from "@/features/brokers/components/brokers-panel";
import { PageHeader } from "@/components/page-header";

export default async function ConfiguracionCorredorasPage() {
  const { db } = await requireOrgDb();
  const brokers = await listBrokers(db);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Corredoras externas"
        description="Maestro de corredoras con las que compartes propuestas en modalidad de co-corredor."
      />
      <BrokersPanel rows={brokers} />
    </div>
  );
}
