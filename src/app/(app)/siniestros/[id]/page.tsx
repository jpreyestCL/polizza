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
import {
  reopenClaimFormAction,
  voidClaimFormAction,
} from "@/features/claims/actions";
import {
  adjustmentDeadlineDays,
  claimWorkflowFamily,
} from "@/lib/domain/claim-workflows";

export default async function SiniestroDetailPage({
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

  const claim = await getClaimDetail(db, id);
  if (!claim) notFound();

  const [activity, documents, members, branchFields] = await Promise.all([
    getClaimActivity(db, id),
    listDocuments(db, "CLAIM", id),
    getOrgMembers(ctx.organizationId),
    claim.branchTypeId ? getBranchFieldSchema(claim.branchTypeId) : [],
  ]);

  const family = claimWorkflowFamily(claim.branchType?.key, null);
  const deadline = family ? adjustmentDeadlineDays(family) : null;

  return (
    <div className="space-y-6">
      {aviso ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">{aviso}</p>
      ) : null}
      {deadline != null ? (
        <p className="text-sm text-muted-foreground">
          Plazo de liquidación de la plantilla: {deadline} días.
        </p>
      ) : null}
      {claim.voidedAt ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          Siniestro anulado. {claim.voidReason ?? ""}
        </p>
      ) : (
        <form action={voidClaimFormAction} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
          <input type="hidden" name="claimId" value={id} />
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
            Anular siniestro
            <input name="reason" required minLength={10} className="rounded-md border bg-background px-2 py-1.5" placeholder="Motivo, al menos 10 caracteres" />
          </label>
          <button type="submit" className="rounded-md border px-3 py-2 text-sm">Anular</button>
        </form>
      )}
      {claim.voidedAt || claim.status === "CERRADO" ? (
        <form action={reopenClaimFormAction} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
          <input type="hidden" name="claimId" value={id} />
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
            Reabrir siniestro
            <input name="reason" required minLength={10} className="rounded-md border bg-background px-2 py-1.5" placeholder="Motivo, al menos 10 caracteres" />
          </label>
          <button type="submit" className="rounded-md border px-3 py-2 text-sm">Reabrir</button>
        </form>
      ) : null}
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
