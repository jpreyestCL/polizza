"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import { hasPermission } from "@/lib/factory-roles";
import { sensitiveReasonError } from "@/lib/domain/sensitive-reason";
import { reopenIssueBlockers } from "@/lib/domain/policy-lifecycle";
import {
  appendPremiumMovement,
  negateCommission,
} from "@/features/ledger/record";
import { logActivity } from "@/server/activity";
import {
  commandFingerprint,
  readIdempotency,
  storeIdempotency,
} from "@/server/idempotency";

const PAID_STATUSES = new Set(["PAGADA", "PARCIAL", "PRESUNTA", "CREDITED"]);

export async function reopenIssueFormAction(form: FormData): Promise<void> {
  const policyId = String(form.get("policyId") ?? "");
  const reason = String(form.get("reason") ?? "");
  const reasonError = sensitiveReasonError(reason);
  if (reasonError) {
    redirect(`/polizas/${policyId}?aviso=${encodeURIComponent(reasonError)}`);
  }
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "policies.reopen")) {
    redirect(
      `/polizas/${policyId}?aviso=${encodeURIComponent("No tienes permiso para reabrir la emisión.")}`,
    );
  }
  const fingerprint = commandFingerprint(`reopen_issue:${reason.trim()}`);
  const prior = await readIdempotency(
    db,
    ctx.organizationId,
    `reopen_issue:${policyId}`,
    fingerprint,
  );
  if (prior.kind === "conflict") {
    redirect(
      `/polizas/${policyId}?aviso=${encodeURIComponent("IDEMPOTENCY_KEY_REUSED: esa reapertura ya se hizo con otro motivo.")}`,
    );
  }
  if (prior.kind === "replay") {
    redirect(`/polizas/${policyId}?aviso=${encodeURIComponent("La emisión ya estaba reabierta.")}`);
  }

  const policy = await db.policy.findFirst({
    where: { id: policyId },
    select: {
      id: true,
      policyNumber: true,
      proposalId: true,
      previousPolicyId: true,
      reopenedIssueAt: true,
    },
  });
  if (!policy) {
    redirect(`/polizas/${policyId}?aviso=${encodeURIComponent("La póliza no existe.")}`);
  }
  if (policy.reopenedIssueAt) {
    redirect(`/polizas/${policyId}?aviso=${encodeURIComponent("La emisión ya está reabierta.")}`);
  }

  const [endorsements, installments, dispatches] = await Promise.all([
    db.endorsement.count({ where: { policyId } }),
    db.installment.findMany({
      where: { policyId },
      select: { id: true, status: true },
    }),
    db.dispatch.count({ where: { policyId, status: "ENVIADO" } }),
  ]);
  const installmentIds = installments.map((row: { id: string }) => row.id);
  const payments =
    installmentIds.length === 0
      ? 0
      : await db.installmentPayment.count({
          where: { installmentId: { in: installmentIds } },
        });
  const presumed = installments.filter((row: { status: string }) =>
    PAID_STATUSES.has(row.status),
  ).length;
  const receivables = await db.commissionReceivable.findMany({
    where: { policyId },
    select: { id: true },
  });
  const allocations =
    receivables.length === 0
      ? 0
      : await db.commissionAllocation.count({
          where: {
            receivableId: {
              in: receivables.map((row: { id: string }) => row.id),
            },
          },
        });
  const blockers = reopenIssueBlockers({
    issuedEndorsements: endorsements,
    appliedPayments: payments + presumed,
    commissionAllocations: allocations,
    sentDispatches: dispatches,
  });
  if (blockers.length > 0) {
    redirect(
      `/polizas/${policyId}?aviso=${encodeURIComponent(`REOPEN_BLOCKED: ${blockers.join(" ")} La corrección va por endoso.`)}`,
    );
  }

  await db.$transaction(async (tx: {
    // El cliente extendido no es asignable a un tipo estructural estricto.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }) => {
    const issues = await tx.premiumMovement.findMany({
      where: { policyId, movementType: "ISSUE" },
    });
    for (const row of issues) {
      const already = await tx.premiumMovement.findFirst({
        where: { reversesMovementId: row.id },
        select: { id: true },
      });
      if (already) continue;
      await appendPremiumMovement(tx, {
        organizationId: ctx.organizationId,
        policyId,
        movementType: "REVERSAL",
        issuedOn: new Date(),
        effectiveOn: row.effectiveOn,
        currency: row.currency,
        createdById: ctx.userId,
        reversesMovementId: row.id,
        receivableStatus: "VOID",
        parts: {
          affected: -Number(row.premiumAffected),
          exempt: -Number(row.premiumExempt),
        },
        commission: negateCommission({
          affected: Number(row.commissionAffected),
          exempt: Number(row.commissionExempt),
          total: Number(row.commissionTotal),
        }),
      });
      await tx.commissionReceivable.updateMany({
        where: { movementId: row.id },
        data: { status: "VOID" },
      });
    }
    await tx.installment.updateMany({
      where: { policyId, status: { in: ["PENDIENTE", "RECHAZADA"] } },
      data: { status: "ANULADA" },
    });
    await tx.dispatch.updateMany({
      where: { policyId, status: "PENDIENTE" },
      data: { status: "CANCELADO" },
    });
    if (policy.proposalId) {
      await tx.proposal.update({
        where: { id: policy.proposalId },
        data: {
          status: "ENVIADA_COMPANIA",
          dispatchedAt: null,
          currentStateStartedAt: new Date(),
        },
      });
    }
    if (policy.previousPolicyId) {
      await tx.policy.updateMany({
        where: {
          id: policy.previousPolicyId,
          status: "RENOVADA",
          nextPolicyId: policy.id,
        },
        data: { status: "VIGENTE", nextPolicyId: null },
      });
    }
    await tx.policy.update({
      where: { id: policyId },
      data: {
        reopenedIssueAt: new Date(),
        reopenedIssueReason: reason.trim(),
        version: { increment: 1 },
      },
    });
  });

  await storeIdempotency(db, {
    organizationId: ctx.organizationId,
    key: `reopen_issue:${policyId}`,
    fingerprint,
    command: "policy.reopen_issue",
    resultJson: { policyId },
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "POLICY",
    entityId: policyId,
    action: "reopen_issue",
    summary: `Emisión de ${policy.policyNumber} reabierta. ${reason.trim()}`,
    userId: ctx.userId,
  });
  revalidatePath(`/polizas/${policyId}`);
  revalidatePath("/propuestas");
  redirect(
    `/polizas/${policyId}?aviso=${encodeURIComponent("La emisión volvió a enviada. La corrección siguiente es recepcionar de nuevo.")}`,
  );
}
