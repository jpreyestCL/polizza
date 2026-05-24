import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import {
  getClaimActivity,
  getClaimDetail,
  getBranchFieldSchema,
} from "@/features/claims/queries";
import { getOrgMembers } from "@/features/clients/queries";
import { listDocuments } from "@/features/documents/queries";
import { canDeleteClaim } from "@/lib/roles";
import { ClaimDetailTabs } from "@/features/claims/components/claim-detail-tabs";
import { ClaimStatusBadge } from "@/features/claims/components/claim-badges";
import { ClaimStatusButton } from "@/features/claims/components/claim-status-button";
import { DeleteClaimDialog } from "@/features/claims/components/delete-claim-dialog";

export default async function SiniestroDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ctx, db } = await requireOrgDb();

  const claim = await getClaimDetail(db, id);
  if (!claim) notFound();

  const [activity, documents, members, branchFields] = await Promise.all([
    getClaimActivity(db, id),
    listDocuments(db, "CLAIM", id),
    getOrgMembers(ctx.organizationId),
    claim.branchTypeId ? getBranchFieldSchema(claim.branchTypeId) : [],
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {claim.claimNumber}
            </h1>
            <ClaimStatusBadge status={claim.status} />
            {claim.companyClaimNumber && (
              <span className="rounded border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Compañía: {claim.companyClaimNumber}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/clientes/${claim.client.id}`}
              className="hover:text-primary"
            >
              {claim.client.name}
            </Link>
            {claim.policy && (
              <>
                {" · Póliza "}
                <Link
                  href={`/polizas/${claim.policy.id}`}
                  className="hover:text-primary"
                >
                  {claim.policy.policyNumber}
                </Link>
              </>
            )}
            {claim.branchType && ` · ${claim.branchType.name}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ClaimStatusButton claimId={id} currentStatus={claim.status} />
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
        branchFields={branchFields}
        members={members}
      />
    </div>
  );
}
