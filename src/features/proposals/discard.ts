"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import { hasPermission } from "@/lib/factory-roles";
import { sensitiveReasonError } from "@/lib/domain/sensitive-reason";
import { canDiscardProposal, isPreIssuePolicy } from "@/lib/domain/policy-lifecycle";
import { logActivity } from "@/server/activity";
import {
  commandFingerprint,
  readIdempotency,
  storeIdempotency,
} from "@/server/idempotency";

export async function discardProposalFormAction(form: FormData): Promise<void> {
  const proposalId = String(form.get("proposalId") ?? "");
  const reason = String(form.get("reason") ?? "");
  const reasonError = sensitiveReasonError(reason);
  if (reasonError) {
    redirect(`/propuestas/${proposalId}?aviso=${encodeURIComponent(reasonError)}`);
  }
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "policies.discard")) {
    redirect(
      `/propuestas/${proposalId}?aviso=${encodeURIComponent("No tienes permiso para descartar.")}`,
    );
  }
  const fingerprint = commandFingerprint(reason.trim());
  const prior = await readIdempotency(
    db,
    ctx.organizationId,
    `discard:${proposalId}`,
    fingerprint,
  );
  if (prior.kind === "conflict") {
    redirect(
      `/propuestas/${proposalId}?aviso=${encodeURIComponent("IDEMPOTENCY_KEY_REUSED: el descarte ya se registró con otro motivo.")}`,
    );
  }
  if (prior.kind === "replay") {
    redirect(`/propuestas/${proposalId}?aviso=${encodeURIComponent("La propuesta ya estaba descartada.")}`);
  }
  const proposal = await db.proposal.findFirst({
    where: { id: proposalId },
    select: { id: true, status: true, proposalNumber: true },
  });
  if (!proposal) {
    redirect(`/propuestas/${proposalId}?aviso=${encodeURIComponent("La propuesta no existe.")}`);
  }
  if (!canDiscardProposal(proposal.status)) {
    redirect(
      `/propuestas/${proposalId}?aviso=${encodeURIComponent("INVALID_TRANSITION: esta propuesta ya no se puede descartar.")}`,
    );
  }
  const policy = await db.policy.findFirst({
    where: { proposalId },
    select: { id: true, status: true },
  });
  if (policy && !isPreIssuePolicy(policy.status)) {
    redirect(
      `/propuestas/${proposalId}?aviso=${encodeURIComponent("INVALID_TRANSITION: ya hay una póliza en la cartera. La corrección va por endoso o por reabrir la emisión.")}`,
    );
  }
  await db.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposalId },
      data: {
        status: "DESCARTADA",
        discardedAt: new Date(),
        discardedReason: reason.trim(),
        currentStateStartedAt: new Date(),
      },
    });
    if (policy) {
      await tx.policy.update({
        where: { id: policy.id },
        data: { status: "DESCARTADA" },
      });
      await tx.policyStatusHistory.create({
        data: {
          organizationId: ctx.organizationId,
          policyId: policy.id,
          status: "DESCARTADA",
          note: reason.trim(),
          changedById: ctx.userId,
        },
      });
    }
  });
  await storeIdempotency(db, {
    organizationId: ctx.organizationId,
    key: `discard:${proposalId}`,
    fingerprint,
    command: "policy.discard",
    resultJson: { proposalId },
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "PROPOSAL",
    entityId: proposalId,
    action: "discarded",
    summary: `Propuesta ${proposal.proposalNumber} descartada. ${reason.trim()}`,
    userId: ctx.userId,
  });
  revalidatePath("/propuestas");
  revalidatePath(`/propuestas/${proposalId}`);
  redirect(`/propuestas/${proposalId}?aviso=${encodeURIComponent("Propuesta descartada.")}`);
}
