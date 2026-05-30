import { notFound } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import { getClientDetail, getOrgMembers } from "@/features/clients/queries";
import { listHoldings } from "@/features/holdings/queries";
import { ClientForm } from "@/features/clients/components/client-form";
import { PageHeader } from "@/components/page-header";
import { formatRut } from "@/lib/rut";
import type { ClientFormValues } from "@/features/clients/schemas";

function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EditarClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ activar?: string }>;
}) {
  const { id } = await params;
  const { activar } = await searchParams;
  const { ctx, db } = await requireOrgDb();

  const client = await getClientDetail(db, id);
  if (!client) notFound();

  // Llegada desde una propuesta con contratante prospecto: se exige activar.
  const forceActive = activar === "1" && client.status === "PROSPECTO";

  const [members, holdings] = await Promise.all([
    getOrgMembers(ctx.organizationId),
    listHoldings(db),
  ]);

  const defaultValues: ClientFormValues = {
    type: client.type,
    status: forceActive ? "ACTIVO" : client.status,
    rut: formatRut(client.rut),
    name: client.name,
    firstName: client.firstName ?? "",
    lastNamePaterno: client.lastNamePaterno ?? "",
    lastNameMaterno: client.lastNameMaterno ?? "",
    legalName: client.legalName ?? "",
    giro: client.giro ?? "",
    birthDate: toDateInput(client.birthDate),
    email: client.email ?? "",
    phone: client.phone ?? "",
    celular: client.celular ?? "",
    address: client.address ?? "",
    region: client.region ?? "",
    commune: client.commune ?? "",
    assignedUserId: client.assignedUserId ?? "",
    vendedor: client.vendedor ?? "",
    cobranzaUserId: client.cobranzaUserId ?? "",
    siniestrosUserId: client.siniestrosUserId ?? "",
    holdingId: client.holdingId ?? "",
    source: client.source ?? "",
    comentarioAlerta: client.comentarioAlerta ?? "",
    observaciones: client.observaciones ?? "",
    contacts: client.contacts.map((contact) => ({
      name: contact.name,
      role: contact.role ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      celular: contact.celular ?? "",
      assignmentType: contact.assignmentType ?? "",
      isPrimary: contact.isPrimary,
    })),
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Editar cliente" description={client.name} />
      <ClientForm
        mode="edit"
        clientId={id}
        members={members}
        holdings={holdings.map((h) => ({ id: h.id, name: h.name }))}
        defaultValues={defaultValues}
      />
    </div>
  );
}
