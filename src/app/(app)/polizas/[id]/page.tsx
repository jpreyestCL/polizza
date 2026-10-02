import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { getPolicyActivity, getPolicyDetail } from "@/features/policies/queries";
import { backfillPolicyIssueMovement } from "@/features/ledger/record";
import { getCompanies, getLines } from "@/features/catalog/queries";
import { getOrgMembers } from "@/features/clients/queries";
import { listDocuments } from "@/features/documents/queries";
import { listPolicyInstallments } from "@/features/billing/queries";
import { getUfValue } from "@/server/uf";
import { renewalInfo } from "@/lib/renewal";
import { isPreIssuePolicy } from "@/lib/domain/policy-lifecycle";
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
import {
  listPolicyEndorsements,
  listPolicyEndorsementProposals,
} from "@/features/endorsements/queries";
import { EndorsementsPanel } from "@/features/endorsements/components/endorsements-panel";
import { NonRenewalPanel } from "@/features/policies/components/non-renewal-panel";
import { reopenIssueFormAction } from "@/features/policies/reopen-issue";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

export default async function PolizaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const aviso = typeof sp.aviso === "string" ? sp.aviso : null;
  const { ctx, db } = await requireOrgDb();

  await backfillPolicyIssueMovement(db, id);
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
    endorsementProposals,
    renewedByProposals,
    policyClaims,
  ] = await Promise.all([
    getPolicyActivity(db, id),
    listDocuments(db, "POLICY", id),
    listPolicyInstallments(db, id),
    getCompanies(db),
    getLines(db),
    getOrgMembers(ctx.organizationId),
    getUfValue(),
    listPolicyEndorsements(db, id),
    listPolicyEndorsementProposals(db, id),
    // Propuestas que renuevan ESTA póliza (previousPolicyId apunta acá)
    db.proposal.findMany({
      where: { previousPolicyId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, proposalNumber: true, status: true },
    }),
    db.claim.findMany({
      where: { policyId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, claimNumber: true },
    }),
  ]);

  const companyName = policy.companyId
    ? (companies.find((c) => c.id === policy.companyId)?.name ?? null)
    : null;
  const lineName = policy.lineId
    ? (lines.find((l) => l.id === policy.lineId)?.name ?? null)
    : (policy.proposal?.branchType?.name ?? null);
  const assignedUserName = policy.assignedUserId
    ? (members.find((m) => m.userId === policy.assignedUserId)?.name ?? null)
    : null;

  const renewal = renewalInfo(policy.status, policy.endDate);
  const openForRenewal =
    policy.status === "VIGENTE" || policy.status === "VENCIDA";
  const canRenew =
    openForRenewal && !policy.notRenewable && !policy.nonRenewalAt;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {policy.policyNumber}
            </h1>
            <PolicyStatusBadge status={policy.status} />
            {policy.termNumber > 1 ? (
              <Badge variant="outline">Período {policy.termNumber}</Badge>
            ) : null}
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
          {isPreIssuePolicy(policy.status) ? null : canRenew && (
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

      {aviso ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">{aviso}</p>
      ) : null}

      {!policy.reopenedIssueAt && policy.status === "VIGENTE" ? (
        <form action={reopenIssueFormAction} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
          <input type="hidden" name="policyId" value={id} />
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
            Reabrir la emisión
            <input name="reason" required minLength={10} className="rounded-md border bg-background px-2 py-1.5" placeholder="Motivo, al menos 10 caracteres" />
          </label>
          <button type="submit" className="rounded-md border px-3 py-2 text-sm">Reabrir emisión</button>
        </form>
      ) : null}
      {policy.reopenedIssueAt ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          La emisión se reabrió. La propuesta volvió a enviada a la compañía.
          {policy.reopenedIssueReason ? ` ${policy.reopenedIssueReason}` : ""}
        </p>
      ) : null}

      {policy.client.comentarioAlerta?.trim() && (
        <ClientAlertBanner message={policy.client.comentarioAlerta} />
      )}

      {policy.issueProblemCode && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Emitida con problemas</p>
          <p>
            {policy.issueProblemCode}
            {policy.issueProblemDetail ? ` — ${policy.issueProblemDetail}` : ""}
          </p>
          <p className="mt-1 text-xs">
            La póliza está en cartera. La corrección se pide con un endoso.
          </p>
        </div>
      )}

      {(openForRenewal || policy.notRenewable || policy.nonRenewalAt) && (
        <NonRenewalPanel
          policyId={id}
          notRenewable={policy.notRenewable}
          reason={policy.nonRenewalReason}
          note={policy.nonRenewalNote}
          recordedAt={policy.nonRenewalAt}
        />
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
        termination={
          policy.terminationBalance != null
            ? {
                balance: Number(policy.terminationBalance),
                isEstimate: policy.terminationBalanceIsEstimate,
                reason: policy.terminationReason,
              }
            : null
        }
      />

      <EndorsementsPanel
        policyId={id}
        endorsements={endorsements}
        endorsementProposals={endorsementProposals}
        policyStatus={policy.status}
        policyEndDate={
          policy.endDate ? policy.endDate.toISOString().slice(0, 10) : ""
        }
        timezone={ctx.organizationTimezone}
        claims={policyClaims}
      />
    </div>
  );
}
