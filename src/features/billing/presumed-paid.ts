"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrgDb } from "@/server/context";
import type { Db } from "@/server/db";
import { presumedPaidDecision } from "@/lib/domain/presumed-paid";
import { hasPermission } from "@/lib/factory-roles";

export async function sweepPresumedPaid(
  db: Db,
  organizationId: string,
  today: Date = new Date(),
): Promise<{ updated: number; skipped: boolean }> {
  const settings = await db.organizationSettings.findUnique({
    where: { organizationId },
  });
  if (!settings?.presumedPaidEnabled) return { updated: 0, skipped: true };

  const plans = await db.paymentPlan.findMany({
    where: { option: { in: ["PAC", "PAT"] } },
    select: { id: true, option: true },
  });
  if (plans.length === 0) return { updated: 0, skipped: false };
  const methodByPlan = new Map(plans.map((plan) => [plan.id, plan.option]));
  const rows = await db.installment.findMany({
    where: {
      status: "PENDIENTE",
      paymentPlanId: { in: plans.map((plan) => plan.id) },
    },
    select: { id: true, dueDate: true, status: true, paymentPlanId: true },
  });
  const ids = rows
    .filter((row) => {
      const method = row.paymentPlanId
        ? (methodByPlan.get(row.paymentPlanId) ?? null)
        : null;
      return (
        presumedPaidDecision({
          enabled: true,
          method,
          status: row.status,
          dueDate: row.dueDate,
          today,
        }) === "PRESUNTA"
      );
    })
    .map((row) => row.id);
  if (ids.length === 0) return { updated: 0, skipped: false };
  const result = await db.installment.updateMany({
    where: { id: { in: ids }, status: "PENDIENTE" },
    data: { status: "PRESUNTA" },
  });
  return { updated: result.count, skipped: false };
}

export async function runPresumedPaidAction(): Promise<void> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "installments.mark_paid")) {
    redirect("/cobranza?aviso=permiso");
  }
  const result = await sweepPresumedPaid(db, ctx.organizationId);
  revalidatePath("/cobranza");
  redirect(
    `/cobranza?presunta=${result.updated}&omitida=${result.skipped ? "1" : "0"}`,
  );
}
