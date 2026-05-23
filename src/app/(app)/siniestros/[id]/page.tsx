import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { getClaimActivity, getClaimDetail } from "@/features/claims/queries";
import { listPolicies } from "@/features/policies/queries";
import { getOrgMembers } from "@/features/clients/queries";
import { listDocuments } from "@/features/documents/queries";
import { getUfValue } from "@/server/uf";
import { canDeleteClaim } from "@/lib/roles";
import { ClaimDetailTabs } from "@/features/claims/components/claim-detail-tabs";
import { ClaimStatusBadge } from "@/features/claims/components/claim-badges";
import { ClaimStatusButton } from "@/features/claims/components/claim-status-button";
import { DeleteClaimDialog } from "@/features/claims/components/delete-claim-dialog";
import { Button } from "@/components/ui/button";

export default async function SiniestroDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ctx, db } = await requireOrgDb();

  const claim = await getClaimDetail(db, id);
  if (!claim) notFound();

  const [activity, documents, policies, members, uf] = await Promise.all([
    getClaimActivity(db, id),
    listDocuments(db, "CLAIM", id),
    listPolicies(ctx, db),
    getOrgMembers(ctx.organizationId),
    getUfValue(),
  ]);

  const policyNumber = claim.policyId
    ? (policies.find((p) => p.id === claim.policyId)?.policyNumber ?? null)
    : null;
  const assignedUserName = claim.assignedUserId
    ? (members.find((m) => m.userId === claim.assignedUserId)?.name ?? null)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {claim.claimNumber}
            </h1>
            <ClaimStatusBadge status={claim.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {claim.client.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ClaimStatusButton claimId={id} currentStatus={claim.status} />
          <Button asChild variant="outline">
            <Link href={`/siniestros/${id}/editar`}>
              <Pencil />
              Editar
            </Link>
          </Button>
          {canDeleteClaim(ctx.role) && (
            <DeleteClaimDialog
              claimId={id}
              claimNumber={claim.claimNumber}
            />
          )}
        </div>
      </div>

      <ClaimDetailTabs
        claim={claim}
        activity={activity}
        documents={documents}
        policyNumber={policyNumber}
        assignedUserName={assignedUserName}
        ufValue={uf?.value ?? null}
      />
    </div>
  );
}
