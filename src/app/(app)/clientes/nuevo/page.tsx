import { requireOrgDb } from "@/server/context";
import { getOrgMembers } from "@/features/clients/queries";
import { listHoldings } from "@/features/holdings/queries";
import { ClientForm } from "@/features/clients/components/client-form";
import { PageHeader } from "@/components/page-header";
import type { ClientFormValues } from "@/features/clients/schemas";

export default async function NuevoClientePage() {
  const { ctx, db } = await requireOrgDb();
  const [members, holdings] = await Promise.all([
    getOrgMembers(ctx.organizationId),
    listHoldings(db),
  ]);

  const defaultValues: ClientFormValues = {
    type: "PERSONA",
    status: "PROSPECTO",
    rut: "",
    name: "",
    legalName: "",
    giro: "",
    birthDate: "",
    email: "",
    phone: "",
    celular: "",
    address: "",
    region: "",
    commune: "",
    assignedUserId: ctx.userId,
    vendedor: "",
    cobranzaUserId: "",
    siniestrosUserId: "",
    holdingId: "",
    source: "",
    comentarioAlerta: "",
    observaciones: "",
    contacts: [],
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo cliente"
        description="Registra una persona o empresa en la cartera."
      />
      <ClientForm
        mode="create"
        members={members}
        holdings={holdings.map((h) => ({ id: h.id, name: h.name }))}
        defaultValues={defaultValues}
      />
    </div>
  );
}
