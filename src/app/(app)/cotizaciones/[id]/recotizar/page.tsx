import { notFound } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import { listClientsForSelect, getOrgMembers } from "@/features/clients/queries";
import { listInsurers } from "@/features/car-quotes/insurers/registry";
import { getRequoteDefaults } from "@/features/car-quotes/actions";
import { QuotationForm } from "@/features/car-quotes/components/quotation-form";
import { PageHeader } from "@/components/page-header";

export default async function RecotizarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ctx, db } = await requireOrgDb();

  const defaults = await getRequoteDefaults(id);
  if (!defaults) notFound();

  const [clients, members] = await Promise.all([
    listClientsForSelect(ctx, db),
    getOrgMembers(ctx.organizationId),
  ]);
  const clientItems = clients.map((c) => ({ id: c.id, name: c.name }));
  const insurers = listInsurers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recotizar"
        description="Datos prellenados desde la cotización anterior. Ajusta lo que necesites y crea una nueva."
      />
      <QuotationForm
        clients={clientItems}
        insurers={insurers}
        members={members}
        defaultValues={defaults}
      />
    </div>
  );
}
