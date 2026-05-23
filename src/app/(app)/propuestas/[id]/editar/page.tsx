import { notFound, redirect } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import {
  getProposalDetail,
  getProposalFormCatalog,
} from "@/features/proposals/queries";
import { isProposalLocked } from "@/features/proposals/schemas";
import { listClients, getOrgMembers } from "@/features/clients/queries";
import { listActiveBrokers } from "@/features/brokers/queries";
import { ProposalForm } from "@/features/proposals/components/proposal-form";
import { PageHeader } from "@/components/page-header";
import type { ProposalFormValues } from "@/features/proposals/schemas";
import type { CurrencyCode } from "@/lib/money";

function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EditarPropuestaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ctx, db } = await requireOrgDb();

  const proposal = await getProposalDetail(db, id);
  if (!proposal) notFound();
  if (isProposalLocked(proposal.status)) {
    redirect(`/propuestas/${id}`);
  }

  const [clients, members, catalog, brokers, coaseguroPart, brokerPart] =
    await Promise.all([
      listClients(ctx, db),
      getOrgMembers(ctx.organizationId),
      getProposalFormCatalog(db),
      listActiveBrokers(db),
      db.proposalCoaseguroParticipation.findMany({
        where: { proposalId: id },
        select: {
          insuranceCompanyId: true,
          participationPct: true,
          policyNumber: true,
        },
      }),
      db.proposalBrokerParticipation.findMany({
        where: { proposalId: id },
        select: { brokerId: true, participationPct: true },
      }),
    ]);

  const defaultValues: ProposalFormValues = {
    clientId: proposal.clientId,
    insuredClientId: proposal.insuredClientId ?? "",
    beneficiaryClientId: proposal.beneficiaryClientId ?? "",
    insuranceCompanyId: proposal.companyId ?? "",
    branchTypeId: proposal.branchTypeId ?? "",
    productId: proposal.productId ?? "",
    lineId: proposal.lineId ?? "",
    branchId: proposal.branchId ?? "",
    premiumNet:
      proposal.premiumNet !== null ? String(proposal.premiumNet) : "",
    premiumGross:
      proposal.premiumGross !== null ? String(proposal.premiumGross) : "",
    currency: proposal.currency as CurrencyCode,
    startDate: toDateInput(proposal.startDate),
    endDate: toDateInput(proposal.endDate),
    sentAt: proposal.sentAt ? proposal.sentAt.toISOString().slice(0, 10) : "",
    recipientEmail: proposal.recipientEmail ?? "",
    recipientContactId: proposal.recipientContactId ?? "",
    quotationId: proposal.quotationId ?? "",
    quotationNumberRef: proposal.quotationNumberRef ?? "",
    previousPolicyId: proposal.previousPolicyId ?? "",
    coaseguro: proposal.coaseguro,
    coaseguroDetails: (proposal.coaseguroDetails as Record<string, string> | null) ?? null,
    coaseguroParticipations: coaseguroPart.map((p) => ({
      insuranceCompanyId: p.insuranceCompanyId,
      participationPct: String(p.participationPct),
      policyNumber: p.policyNumber ?? "",
    })),
    coCorredor: proposal.coCorredor,
    coCorredorDetails: (proposal.coCorredorDetails as Record<string, string> | null) ?? null,
    brokerParticipations: brokerPart.map((p) => ({
      brokerId: p.brokerId,
      participationPct: String(p.participationPct),
    })),
    reaseguro: proposal.reaseguro,
    reaseguroDetails: (proposal.reaseguroDetails as Record<string, string> | null) ?? null,
    deOtroCorredor: proposal.deOtroCorredor,
    garantiaSuscripcion: proposal.garantiaSuscripcion,
    garantiaObservations: proposal.garantiaObservations ?? "",
    garantiaExpiry: toDateInput(proposal.garantiaExpiry),
    garantiaCompleted: proposal.garantiaCompleted,
    garantiaCompletedAt: toDateInput(proposal.garantiaCompletedAt),
    conReserva: proposal.conReserva,
    conClausulaInalterabilidad: proposal.conClausulaInalterabilidad,
    facultativo: proposal.facultativo,
    isRenewal: proposal.isRenewal,
    previousPolicyNumberText: proposal.previousPolicyNumberText ?? "",
    commissionAffectPct:
      proposal.commissionAffectPct !== null
        ? String(proposal.commissionAffectPct)
        : "",
    commissionExemptPct:
      proposal.commissionExemptPct !== null
        ? String(proposal.commissionExemptPct)
        : "",
    observations: proposal.observations ?? "",
    assignedUserId: proposal.assignedUserId ?? "",
    salespersonId: proposal.salespersonId ?? "",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          proposal.proposalNumber.startsWith("DRAFT-")
            ? "Nueva propuesta"
            : `Propuesta: ${proposal.proposalNumber}`
        }
      />
      <ProposalForm
        mode="edit"
        proposalId={id}
        initialProposalNumber={
          proposal.proposalNumber.startsWith("DRAFT-")
            ? null
            : proposal.proposalNumber
        }
        clients={clients.map((c) => ({ id: c.id, name: c.name, rut: c.rut ?? null }))}
        members={members}
        brokers={brokers}
        catalog={catalog}
        defaultValues={defaultValues}
      />
    </div>
  );
}
