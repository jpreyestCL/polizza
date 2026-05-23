"use server";

import { revalidatePath } from "next/cache";
import { requireOrgDb } from "@/server/context";
import { logActivity } from "@/server/activity";
import { generatePlanSchema, type GeneratePlanValues } from "./schemas";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

function addMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      date.getUTCDate(),
    ),
  );
}

export async function generateInstallmentPlanAction(
  policyId: string,
  values: GeneratePlanValues,
): Promise<ActionResult> {
  const parsed = generatePlanSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const policy = await db.policy.findFirst({
    where: { id: policyId },
    select: { id: true, policyNumber: true },
  });
  if (!policy) {
    return { ok: false, error: "La póliza no existe o no tienes acceso." };
  }

  const firstDue = new Date(data.firstDueDate);
  if (Number.isNaN(firstDue.getTime())) {
    return { ok: false, error: "La fecha de la primera cuota es inválida." };
  }
  const count = Number(data.count);

  const existing = await db.installment.findFirst({
    where: { policyId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const startNumber = (existing?.number ?? 0) + 1;

  await db.installment.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      organizationId: ctx.organizationId,
      policyId,
      number: startNumber + i,
      amount: data.amount,
      currency: data.currency,
      dueDate: addMonths(firstDue, i),
      status: "PENDIENTE" as const,
    })),
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "POLICY",
    entityId: policyId,
    action: "installments_generated",
    summary: `Plan de ${count} cuota(s) generado para la póliza ${policy.policyNumber}`,
    userId: ctx.userId,
  });

  revalidatePath("/cobranza");
  revalidatePath(`/polizas/${policyId}`);
  return { ok: true };
}

async function getInstallmentWithPolicy(
  db: Awaited<ReturnType<typeof requireOrgDb>>["db"],
  id: string,
) {
  return db.installment.findFirst({
    where: { id },
    select: { id: true, number: true, policyId: true },
  });
}

export async function markInstallmentPaidAction(
  id: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  const installment = await getInstallmentWithPolicy(db, id);
  if (!installment) {
    return { ok: false, error: "La cuota no existe o no tienes acceso." };
  }
  if (!installment.policyId) {
    return {
      ok: false,
      error: "La cuota no está vinculada a una póliza.",
    };
  }

  await db.installment.update({
    where: { id },
    data: { status: "PAGADA", paidAt: new Date() },
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "POLICY",
    entityId: installment.policyId,
    action: "installment_paid",
    summary: `Cuota ${installment.number} marcada como pagada`,
    userId: ctx.userId,
  });

  revalidatePath("/cobranza");
  revalidatePath(`/polizas/${installment.policyId}`);
  return { ok: true };
}

export async function markInstallmentPendingAction(
  id: string,
): Promise<ActionResult> {
  const { db } = await requireOrgDb();
  const installment = await getInstallmentWithPolicy(db, id);
  if (!installment) {
    return { ok: false, error: "La cuota no existe o no tienes acceso." };
  }

  await db.installment.update({
    where: { id },
    data: { status: "PENDIENTE", paidAt: null },
  });

  revalidatePath("/cobranza");
  revalidatePath(`/polizas/${installment.policyId}`);
  return { ok: true };
}

export async function deleteInstallmentAction(
  id: string,
): Promise<ActionResult> {
  const { db } = await requireOrgDb();
  const installment = await getInstallmentWithPolicy(db, id);
  if (!installment) {
    return { ok: false, error: "La cuota no existe o no tienes acceso." };
  }

  await db.installment.delete({ where: { id } });

  revalidatePath("/cobranza");
  revalidatePath(`/polizas/${installment.policyId}`);
  return { ok: true };
}
