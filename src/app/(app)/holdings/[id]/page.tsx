import { notFound } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import {
  getHoldingDetail,
  listClientsWithoutHolding,
} from "@/features/holdings/queries";
import { HoldingActions } from "@/features/holdings/components/holding-actions";
import { HoldingClientsPanel } from "@/features/holdings/components/holding-clients-panel";

export default async function HoldingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { db } = await requireOrgDb();

  const holding = await getHoldingDetail(db, id);
  if (!holding) notFound();

  const availableClients = await listClientsWithoutHolding(db);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            {holding.name}
          </h1>
          {holding.notes && (
            <p className="max-w-prose text-sm text-muted-foreground">
              {holding.notes}
            </p>
          )}
        </div>
        <HoldingActions
          holding={{
            id: holding.id,
            name: holding.name,
            notes: holding.notes,
          }}
        />
      </div>

      <HoldingClientsPanel
        holdingId={holding.id}
        clients={holding.clients}
        availableClients={availableClients}
      />
    </div>
  );
}
