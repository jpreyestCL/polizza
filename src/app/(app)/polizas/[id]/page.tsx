import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { getPolicyActivity, getPolicyDetail } from "@/features/policies/queries";
import { getCompanies, getLines } from "@/features/catalog/queries";
import { getOrgMembers } from "@/features/clients/queries";
import { listDocuments } from "@/features/documents/queries";
import { listPolicyInstallments } from "@/features/billing/queries";
import { getUfValue } from "@/server/uf";
import { renewalInfo } from "@/lib/renewal";
import { canDeletePolicy } from "@/lib/roles";
import { PolicyDetailTabs } from "@/features/policies/components/policy-detail-tabs";
import {
  PolicyRenewalBadge,
  PolicyStatusBadge,
} from "@/features/policies/components/policy-badges";
import { PolicyStatusButton } from "@/features/policies/components/policy-status-button";
import { RenewPolicyButton } from "@/features/policies/components/renew-policy-button";
import { DeletePolicyDialog } from "@/features/policies/components/delete-policy-dialog";
import { ClientAlertBanner } from "@/components/alert-banner";
import { Button } from "@/components/ui/button";
import { listPolicyEndorsements } from "@/features/endorsements/queries";
import { EndorsementsPanel } from "@/features/endorsements/components/endorsements-panel";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

export default async function PolizaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ctx, db } = await requireOrgDb();

  const policy = await getPolicyDetail(db, id);
  if (!policy) notFound();

  const [
    activity,
    documents,
    installments,
    companies,
    lines,
    members,
    uf,
    endorsements,
    renewedByProposals,
  ] = await Promise.all([
    getPolicyActivity(db, id),
    listDocuments(db, "POLICY", id),
    listPolicyInstallments(db, id),
    getCompanies(db),
    getLines(db),
    getOrgMembers(ctx.organizationId),
    getUfValue(),
    listPolicyEndorsements(db, id),
    // Propuestas que renuevan ESTA póliza (previousPolicyId apunta acá)
    db.proposal.findMany({
      where: { previousPolicyId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, proposalNumber: true, status: true },
    }),
  ]);

  const companyName = policy.companyId
    ? (companies.find((c) => c.id === policy.companyId)?.name ?? null)
    : null;
  const lineName = policy.lineId
    ? (lines.find((l) => l.id === policy.lineId)?.name ?? null)
    : null;
  const assignedUserName = policy.assignedUserId
    ? (members.find((m) => m.userId === policy.assignedUserId)?.name ?? null)
    : null;

  const renewal = renewalInfo(policy.status, policy.endDate);
  const canRenew = policy.status === "VIGENTE" || policy.status === "VENCIDA";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {policy.policyNumber}
            </h1>
            <PolicyStatusBadge status={policy.status} />
            <PolicyRenewalBadge
              level={renewal.level}
              days={renewal.daysToExpiry}
            />
            {endorsements.length > 0 && (
              <Badge variant="outline">
                {endorsements.length}{" "}
                {endorsements.length === 1 ? "endoso" : "endosos"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {policy.client.name}
          </p>
          {renewedByProposals.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Renovada por:</span>
              {renewedByProposals.map((p) => (
                <Link
                  key={p.id}
                  href={`/propuestas/${p.id}`}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-0.5 hover:bg-muted"
                >
                  {p.proposalNumber}
                  <ArrowRight className="size-3" />
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <PolicyStatusButton policyId={id} currentStatus={policy.status} />
          {canRenew && (
            <RenewPolicyButton
              policyId={id}
              policyNumber={policy.policyNumber}
            />
          )}
          <Button asChild variant="outline">
            <Link href={`/polizas/${id}/editar`}>
              <Pencil />
              Editar
            </Link>
          </Button>
          {canDeletePolicy(ctx.role) && (
            <DeletePolicyDialog
              policyId={id}
              policyNumber={policy.policyNumber}
            />
          )}
        </div>
      </div>

      {policy.client.comentarioAlerta?.trim() && (
        <ClientAlertBanner message={policy.client.comentarioAlerta} />
      )}

      <PolicyDetailTabs
        policy={policy}
        activity={activity}
        documents={documents}
        installments={installments}
        companyName={companyName}
        lineName={lineName}
        assignedUserName={assignedUserName}
        ufValue={uf?.value ?? null}
      />

      <EndorsementsPanel
        policyId={id}
        endorsements={endorsements}
        policyStatus={policy.status}
      />
    </div>
  );
}
