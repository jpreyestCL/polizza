import Link from "next/link";
import { Users } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listClientsForSelect, getOrgMembers } from "@/features/clients/queries";
import { listInsurers } from "@/features/car-quotes/insurers/registry";
import { QuotationForm } from "@/features/car-quotes/components/quotation-form";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { CarQuotationFormValues } from "@/features/car-quotes/schemas";

export default async function NuevaCotizacionPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { ctx, db } = await requireOrgDb();
  const { cliente } = await searchParams;
  const [clients, members] = await Promise.all([
    listClientsForSelect(ctx, db),
    getOrgMembers(ctx.organizationId),
  ]);
  const clientItems = clients.map((c) => ({ id: c.id, name: c.name }));
  const insurers = listInsurers();

  const defaultValues: CarQuotationFormValues = {
    clientId: cliente && clientItems.some((c) => c.id === cliente) ? cliente : "",
    patente: "",
    marca: "",
    modelo: "",
    anio: "",
    tipoVehiculo: "",
    motorizacion: "",
    vehicleCondition: "USADO",
    vehicleUse: "PARTICULAR",
    civilLiability: "UF_500",
    workshopType: "EXCLUSIVIDAD",
    deductibles: [],
    insurerKeys: insurers.map((i) => i.key),
    assignedUserId: ctx.userId,
    notes: "",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva cotización"
        description="Selecciona cliente, vehículo y aseguradoras. El sistema cotiza en paralelo en cada una."
      />
      {clientItems.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Necesitas un cliente primero"
          description="Una cotización siempre se asocia a un cliente."
          action={
            <Button asChild>
              <Link href="/clientes/nuevo">Crear cliente</Link>
            </Button>
          }
        />
      ) : (
        <QuotationForm
          clients={clientItems}
          insurers={insurers}
          members={members}
          defaultValues={defaultValues}
        />
      )}
    </div>
  );
}
