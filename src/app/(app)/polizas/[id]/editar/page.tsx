import { notFound } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import { getPolicyDetail } from "@/features/policies/queries";
import { listClients, getOrgMembers } from "@/features/clients/queries";
import { getCompanies, getLines } from "@/features/catalog/queries";
import { listOrgBranches } from "@/features/branches/queries";
import { PolicyForm } from "@/features/policies/components/policy-form";
import { PageHeader } from "@/components/page-header";
import type { PolicyFormValues } from "@/features/policies/schemas";
import type { CurrencyCode } from "@/lib/money";

function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EditarPolizaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ctx, db } = await requireOrgDb();

  const policy = await getPolicyDetail(db, id);
  if (!policy) notFound();

  const [clients, companies, lines, members, branches] = await Promise.all([
    listClients(ctx, db),
    getCompanies(db),
    getLines(db),
    getOrgMembers(ctx.organizationId),
    listOrgBranches(db),
  ]);

  const defaultValues: PolicyFormValues = {
    clientId: policy.clientId,
    proposalId: policy.proposalId ?? "",
    policyNumber: policy.policyNumber,
    companyId: policy.companyId ?? "",
    lineId: policy.lineId ?? "",
    branchId: policy.branchId ?? "",
    premiumNet: policy.premiumNet !== null ? String(policy.premiumNet) : "",
    currency: policy.currency as CurrencyCode,
    startDate: toDateInput(policy.startDate),
    endDate: toDateInput(policy.endDate),
    assignedUserId: policy.assignedUserId ?? "",
    items: policy.items.map((item) => ({
      description: item.description,
      insuredAmount:
        item.insuredAmount !== null ? String(item.insuredAmount) : "",
    })),
    coverages: policy.coverages.map((coverage) => ({
      name: coverage.name,
      deductible: coverage.deductible ?? "",
      insuredAmount:
        coverage.insuredAmount !== null
          ? String(coverage.insuredAmount)
          : "",
    })),
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Editar póliza" description={policy.policyNumber} />
      <PolicyForm
        mode="edit"
        policyId={id}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        companies={companies}
        lines={lines}
        members={members}
        branches={branches}
        defaultValues={defaultValues}
      />
    </div>
  );
}
