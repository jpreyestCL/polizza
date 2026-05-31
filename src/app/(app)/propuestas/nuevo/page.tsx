import Link from "next/link";
import { Users } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listClientsForSelect, getOrgMembers } from "@/features/clients/queries";
import { listActiveBrokers } from "@/features/brokers/queries";
import { getProposalFormCatalog } from "@/features/proposals/queries";
import { ProposalForm } from "@/features/proposals/components/proposal-form";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { ProposalFormValues } from "@/features/proposals/schemas";

export default async function NuevaPropuestaPage() {
  const { ctx, db } = await requireOrgDb();
  const [clients, members, catalog, brokers] = await Promise.all([
    listClientsForSelect(ctx, db),
    getOrgMembers(ctx.organizationId),
    getProposalFormCatalog(db),
    listActiveBrokers(db),
  ]);
  const clientItems = clients.map((c) => ({
    id: c.id,
    name: c.name,
    rut: c.rut ?? null,
    status: c.status,
  }));

  const defaultValues: ProposalFormValues = {
    clientId: "",
    insuredClientId: "",
    beneficiaryClientId: "",
    insuranceCompanyId: "",
    branchTypeId: "",
    productId: "",
    lineId: "",
    branchId: "",
    premiumNet: "",
    premiumGross: "",
    currency: "UF",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    sentAt: "",
    recipientEmail: "",
    recipientContactId: "",
    contratanteEmail: "",
    contratantePhone: "",
    contratanteCelular: "",
    quotationId: "",
    quotationNumberRef: "",
    previousPolicyId: "",
    coaseguro: false,
    coaseguroDetails: null,
    coaseguroParticipations: [],
    coCorredor: false,
    coCorredorDetails: null,
    brokerParticipations: [],
    reaseguro: false,
    reaseguroDetails: null,
    deOtroCorredor: false,
    garantiaSuscripcion: false,
    garantiaObservations: "",
    garantiaExpiry: "",
    garantiaCompleted: false,
    garantiaCompletedAt: "",
    conReserva: false,
    conClausulaInalterabilidad: false,
    facultativo: false,
    isRenewal: false,
    previousPolicyNumberText: "",
    commissionAffectPct: "",
    commissionExemptPct: "",
    observations: "",
    assignedUserId: ctx.userId,
    salespersonId: "",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva propuesta"
        description="Carátula con datos del contratante, compañía, ramo, producto, vigencia y relaciones. Los ítems y plan de pago se gestionan tras crear la propuesta."
      />
      {clientItems.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Necesitas un cliente primero"
          description="Una propuesta siempre se asocia a un cliente. Crea un cliente antes de continuar."
          action={
            <Button asChild>
              <Link href="/clientes/nuevo">Crear cliente</Link>
            </Button>
          }
        />
      ) : catalog.companies.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No tienes compañías configuradas"
          description="Antes de crear propuestas, agrega al menos una compañía aseguradora desde Configuración."
          action={
            <Button asChild>
              <Link href="/configuracion/companias">Configurar compañías</Link>
            </Button>
          }
        />
      ) : (
        <ProposalForm
          mode="create"
          clients={clientItems}
          members={members}
          brokers={brokers}
          catalog={catalog}
          defaultValues={defaultValues}
        />
      )}
    </div>
  );
}
