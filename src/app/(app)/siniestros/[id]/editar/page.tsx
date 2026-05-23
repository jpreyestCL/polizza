import { notFound } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import { getClaimDetail } from "@/features/claims/queries";
import { listClients, getOrgMembers } from "@/features/clients/queries";
import { listPolicies } from "@/features/policies/queries";
import { ClaimForm } from "@/features/claims/components/claim-form";
import { PageHeader } from "@/components/page-header";
import type { ClaimFormValues } from "@/features/claims/schemas";
import type { CurrencyCode } from "@/lib/money";

function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EditarSiniestroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ctx, db } = await requireOrgDb();

  const claim = await getClaimDetail(db, id);
  if (!claim) notFound();

  const [clients, policies, members] = await Promise.all([
    listClients(ctx, db),
    listPolicies(ctx, db),
    getOrgMembers(ctx.organizationId),
  ]);

  const defaultValues: ClaimFormValues = {
    clientId: claim.clientId,
    policyId: claim.policyId ?? "",
    description: claim.description,
    occurredAt: toDateInput(claim.occurredAt),
    reportedAt: toDateInput(claim.reportedAt),
    estimatedAmount:
      claim.estimatedAmount !== null ? String(claim.estimatedAmount) : "",
    settledAmount:
      claim.settledAmount !== null ? String(claim.settledAmount) : "",
    currency: claim.currency as CurrencyCode,
    assignedUserId: claim.assignedUserId ?? "",
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Editar siniestro" description={claim.claimNumber} />
      <ClaimForm
        mode="edit"
        claimId={id}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        policies={policies.map((p) => ({ id: p.id, name: p.policyNumber }))}
        members={members}
        defaultValues={defaultValues}
      />
    </div>
  );
}
