import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, ShieldCheck } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { basePrisma } from "@/server/db";
import {
  getProposalActivity,
  getProposalDetail,
  getProposalPremiumTotals,
} from "@/features/proposals/queries";
import { isProposalLocked } from "@/features/proposals/schemas";
import {
  getCompanies,
  getReturnReasons,
} from "@/features/catalog/queries";
import { listClients, getOrgMembers } from "@/features/clients/queries";
import { listDocuments } from "@/features/documents/queries";
import {
  listProposalItems,
  getBranchFieldSchemas,
  type BranchFieldDef,
} from "@/features/proposal-items/queries";
import { ProposalItemsPanel } from "@/features/proposal-items/components/items-panel";
import {
  getPaymentPlan,
  listProposalLogs,
} from "@/features/payment-plan/queries";
import { PaymentPlanPanel } from "@/features/payment-plan/components/payment-plan-panel";
import { PdfAndEmailButtons } from "@/features/proposal-pdf/components/pdf-and-email-buttons";
import { getUfValue } from "@/server/uf";
import { ProposalDetailTabs } from "@/features/proposals/components/proposal-detail-tabs";
import { BitacoraPanel } from "@/features/payment-plan/components/bitacora-panel";
import { ProposalStatusBadge } from "@/features/proposals/components/proposal-badges";
import { ProposalStatusButton } from "@/features/proposals/components/proposal-status-button";
import { DeleteProposalDialog } from "@/features/proposals/components/delete-proposal-dialog";
import { canDeleteProposal } from "@/lib/roles";
import { ClientAlertBanner } from "@/components/alert-banner";
import { Button } from "@/components/ui/button";

export default async function PropuestaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ctx, db } = await requireOrgDb();

  const proposal = await getProposalDetail(db, id);
  if (!proposal) notFound();

  const [
    activity,
    documents,
    companies,
    members,
    returnReasons,
    uf,
    items,
    clients,
    branches,
    paymentPlan,
    logs,
    premiumTotals,
  ] = await Promise.all([
    getProposalActivity(db, id),
    listDocuments(db, "PROPOSAL", id),
    getCompanies(db),
    getOrgMembers(ctx.organizationId),
    getReturnReasons(db),
    getUfValue(),
    listProposalItems(db, id),
    listClients(ctx, db),
    basePrisma.branchType.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    getPaymentPlan(db, id),
    listProposalLogs(db, id),
    getProposalPremiumTotals(db, id),
  ]);

  // Pre-cargar field schemas para todos los ramos (cliente los necesita para
  // renderizar la ficha al cambiar de ramo en el modal).
  const fieldSchemasByBranch: Record<string, BranchFieldDef[]> = {};
  await Promise.all(
    branches.map(async (b) => {
      fieldSchemasByBranch[b.id] = await getBranchFieldSchemas(b.id);
    }),
  );

  const companyName = proposal.companyId
    ? (companies.find((c) => c.id === proposal.companyId)?.name ?? null)
    : null;
  const branchTypeName = proposal.branchType?.name ?? null;
  const assignedUserName = proposal.assignedUserId
    ? (members.find((m) => m.userId === proposal.assignedUserId)?.name ?? null)
    : null;
  const locked = isProposalLocked(proposal.status);

  const defaultInsured = proposal.insuredClientId
    ? (clients.find((c) => c.id === proposal.insuredClientId) ?? null)
    : null;
  const defaultBeneficiary = proposal.beneficiaryClientId
    ? (clients.find((c) => c.id === proposal.beneficiaryClientId) ?? null)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {proposal.proposalNumber}
            </h1>
            <ProposalStatusBadge status={proposal.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {proposal.client.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PdfAndEmailButtons
            proposalId={id}
            proposalNumber={proposal.proposalNumber}
            clientName={proposal.client.name}
            organizationName={ctx.organizationName}
            defaultEmail={proposal.recipientEmail}
            contacts={
              proposal.companyId
                ? await db.insuranceCompanyContact.findMany({
                    where: { insuranceCompanyId: proposal.companyId },
                    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
                    select: {
                      id: true,
                      name: true,
                      lastName: true,
                      email: true,
                      isDefault: true,
                    },
                  })
                : []
            }
            documents={documents.map((d) => ({
              id: d.id,
              fileName: d.fileName,
            }))}
            status={proposal.status}
            hasStoredPdf={proposal.hasStoredPdf}
          />
          <ProposalStatusButton
            proposalId={id}
            currentStatus={proposal.status}
            returnReasons={returnReasons}
          />
          {["EMITIDA", "POR_DESPACHAR", "DESPACHADA"].includes(
            proposal.status,
          ) && (
            <Button asChild variant="outline">
              <Link href={`/polizas/nuevo?fromProposal=${id}`}>
                <ShieldCheck />
                Convertir a póliza
              </Link>
            </Button>
          )}
          {!locked && (
            <Button asChild variant="outline">
              <Link href={`/propuestas/${id}/editar`}>
                <Pencil />
                Editar
              </Link>
            </Button>
          )}
          {canDeleteProposal(ctx.role) && !locked && (
            <DeleteProposalDialog
              proposalId={id}
              proposalNumber={proposal.proposalNumber}
            />
          )}
        </div>
      </div>

      {proposal.client.comentarioAlerta?.trim() && (
        <ClientAlertBanner message={proposal.client.comentarioAlerta} />
      )}

      <ProposalDetailTabs
        proposal={proposal}
        activity={activity}
        documents={documents}
        companyName={companyName}
        branchTypeName={branchTypeName}
        assignedUserName={assignedUserName}
        ufValue={uf?.value ?? null}
        premiumTotals={premiumTotals}
        timezone={ctx.organizationTimezone}
      />

      <ProposalItemsPanel
        proposalId={id}
        productId={proposal.productId ?? null}
        items={items}
        branches={branches}
        clients={clients.map((c) => ({ id: c.id, name: c.name, rut: c.rut ?? null }))}
        fieldSchemasByBranch={fieldSchemasByBranch}
        defaultBranchTypeId={proposal.branchTypeId}
        defaultInsuredId={proposal.insuredClientId}
        defaultInsuredName={defaultInsured?.name ?? null}
        defaultInsuredRut={defaultInsured?.rut ?? null}
        defaultBeneficiaryId={proposal.beneficiaryClientId}
        defaultBeneficiaryName={defaultBeneficiary?.name ?? null}
        defaultBeneficiaryRut={defaultBeneficiary?.rut ?? null}
        defaultCommissionAffectPct={proposal.commissionAffectPct}
        defaultCommissionExemptPct={proposal.commissionExemptPct}
        locked={locked}
      />

      <PaymentPlanPanel
        proposalId={id}
        currency={proposal.currency}
        plan={
          paymentPlan
            ? {
                sinPlanDePago: paymentPlan.sinPlanDePago,
                option: paymentPlan.option,
                installmentsCount: paymentPlan.installmentsCount,
                observations: paymentPlan.observations,
                documented: paymentPlan.documented,
                firstPaymentDate: paymentPlan.firstPaymentDate,
                firstSignDate: paymentPlan.firstSignDate,
                valorCuota: paymentPlan.valorCuota
                  ? Number(paymentPlan.valorCuota)
                  : null,
                cobrAnticipada: paymentPlan.cobrAnticipada,
                facturaAnticipada: paymentPlan.facturaAnticipada,
                requiereFactura: paymentPlan.requiereFactura,
                primaBruta: paymentPlan.primaBruta
                  ? Number(paymentPlan.primaBruta)
                  : null,
                cambio: paymentPlan.cambio ? Number(paymentPlan.cambio) : null,
                primaTotalPesos: paymentPlan.primaTotalPesos
                  ? Number(paymentPlan.primaTotalPesos)
                  : null,
                payerRut: paymentPlan.payerRut,
                payerName: paymentPlan.payerName,
                payerLastName: paymentPlan.payerLastName,
                payerLegalName: paymentPlan.payerLegalName,
                payerPhone: paymentPlan.payerPhone,
                payerCelular: paymentPlan.payerCelular,
                payerEmail: paymentPlan.payerEmail,
              }
            : null
        }
      />

      <BitacoraPanel
        proposalId={id}
        logs={logs}
        members={members}
        timezone={ctx.organizationTimezone}
      />
    </div>
  );
}
