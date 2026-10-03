"use server";

import { revalidatePath } from "next/cache";
import { requireOrgDb } from "@/server/context";
import { logActivity, logAudit } from "@/server/activity";
import { hasPermission } from "@/lib/factory-roles";
import { sensitiveReasonError } from "@/lib/domain/sensitive-reason";
import {
  generatePlanSchema,
  INSTALLMENT_STATUSES,
  INSTALLMENT_STATUS_LABELS,
  type GeneratePlanValues,
  type InstallmentStatusValue,
} from "./schemas";

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
  if (!hasPermission(ctx.role, "installments.mark_paid")) {
    return { ok: false, error: "No tienes permiso para registrar pagos." };
  }
  const installment = await db.installment.findFirst({
    where: { id },
    select: {
      id: true,
      number: true,
      policyId: true,
      amount: true,
      amountPaid: true,
      status: true,
    },
  });
  if (!installment) {
    return { ok: false, error: "La cuota no existe o no tienes acceso." };
  }
  if (!installment.policyId) {
    return {
      ok: false,
      error: "La cuota no está vinculada a una póliza.",
    };
  }

  if (installment.status === "PAGADA") return { ok: true };
  const today = new Date();
  await db.$transaction(async (tx) => {
    await tx.installment.update({
      where: { id },
      data: { status: "PAGADA", paidAt: today, amountPaid: null },
    });
    await tx.installmentPayment.create({
      data: {
        organizationId: ctx.organizationId,
        installmentId: id,
        amount: Math.max(
          0,
          Number(installment.amount) - Number(installment.amountPaid ?? 0),
        ).toFixed(4),
        paidOn: today,
        markedOn: today,
        source: "MANUAL",
        createdById: ctx.userId,
      },
    });
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

const MANUAL_INSTALLMENT_STATUSES = INSTALLMENT_STATUSES.filter(
  (status) => status !== "ANULADA" && status !== "CREDITED",
);

/**
 * Cambia el estado de una cuota a mano. Presunta pagada no se asigna sola:
 * solo queda si alguien la marca. Anulada queda reservada al cierre por
 * cancelación o anulación.
 */
export async function setInstallmentStatusAction(
  id: string,
  status: InstallmentStatusValue,
  amountPaid?: number | null,
  companyRegisteredOn?: string | null,
  reason?: string | null,
): Promise<ActionResult> {
  if (status === "ANULADA" || status === "CREDITED") {
    return { ok: false, error: "Ese estado no se asigna a mano." };
  }
  if (!MANUAL_INSTALLMENT_STATUSES.includes(status)) {
    return { ok: false, error: "Ese estado no se asigna a mano." };
  }
  const { ctx, db } = await requireOrgDb();
  const installment = await db.installment.findFirst({
    where: { id },
    select: {
      id: true,
      number: true,
      amount: true,
      amountPaid: true,
      policyId: true,
      voidedByTermination: true,
      status: true,
    },
  });
  if (!installment) {
    return { ok: false, error: "La cuota no existe o no tienes acceso." };
  }
  if (installment.voidedByTermination) {
    return {
      ok: false,
      error: "La cuota se anuló al cancelar o anular la póliza.",
    };
  }
  if (
    status === "CASTIGADA" &&
    !hasPermission(ctx.role, "installments.write_off")
  ) {
    return { ok: false, error: "No tienes permiso para realizar este cambio." };
  }
  if (
    ((installment.status === "PAGADA" && status !== "PAGADA") ||
      (installment.status === "PRESUNTA" && status !== "PRESUNTA") ||
      (installment.status === "PARCIAL" &&
        (status !== "PARCIAL" ||
          Number(installment.amountPaid ?? 0) !== Number(amountPaid ?? 0)))) &&
    !hasPermission(ctx.role, "installments.edit_paid")
  ) {
    return { ok: false, error: "No tienes permiso para revertir pagos." };
  }
  if (
    status !== "CASTIGADA" &&
    !(
      (installment.status === "PAGADA" && status !== "PAGADA") ||
      (installment.status === "PRESUNTA" && status !== "PRESUNTA") ||
      (installment.status === "PARCIAL" && status !== "PARCIAL")
    ) &&
    !hasPermission(ctx.role, "installments.mark_paid")
  ) {
    return { ok: false, error: "No tienes permiso para realizar este cambio." };
  }
  if (
    (status === "CASTIGADA" ||
      (installment.status === "PAGADA" && status !== "PAGADA") ||
      (installment.status === "PRESUNTA" && status !== "PRESUNTA") ||
      (installment.status === "PARCIAL" &&
        (status !== "PARCIAL" ||
          Number(installment.amountPaid ?? 0) !== Number(amountPaid ?? 0)))) &&
    sensitiveReasonError(reason)
  ) {
    return { ok: false, error: sensitiveReasonError(reason)! };
  }
  if (status === "PARCIAL") {
    const quota = Number(installment.amount);
    if (amountPaid == null || !Number.isFinite(amountPaid) || amountPaid <= 0) {
      return {
        ok: false,
        error: "Indica cuánto se cobró de esta cuota parcial.",
      };
    }
    if (amountPaid >= quota) {
      return {
        ok: false,
        error: "Si se cobró el total, márcala como pagada.",
      };
    }
  }
  const collected = status === "PAGADA" || status === "PRESUNTA";
  const paidAmount =
    status === "PARCIAL" && amountPaid != null
      ? amountPaid
      : status === "PAGADA"
        ? Math.max(
            0,
            Number(installment.amount) -
              (installment.status === "PARCIAL"
                ? Number(installment.amountPaid ?? 0)
                : 0),
          )
        : null;
  await db.installment.update({
    where: { id },
    data: {
      status,
      paidAt: collected ? new Date() : null,
      amountPaid:
        status === "PARCIAL" && amountPaid != null ? amountPaid : null,
    },
  });
  if (
    installment.policyId &&
    ((installment.status === "PAGADA" && status !== "PAGADA") ||
      (installment.status === "PRESUNTA" && status !== "PRESUNTA") ||
      (installment.status === "PARCIAL" &&
        (status !== "PARCIAL" ||
          Number(installment.amountPaid ?? 0) !== Number(amountPaid ?? 0))))
  ) {
    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "POLICY",
      entityId: installment.policyId,
      action: "installment_payment_reverted",
      summary: `Pago de cuota ${installment.number} revertido`,
      userId: ctx.userId,
      metadata: { reason: reason!.trim() },
    });
    await logAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "installments.collected_edited",
      metadata: {
        installmentId: id,
        from: installment.status,
        to: status,
        reason: reason!.trim(),
      },
    });
  }
  if (status === "CASTIGADA") {
    await logAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "installments.written_off",
      metadata: { installmentId: id, reason: reason!.trim() },
    });
  }
  if (paidAmount != null && paidAmount > 0) {
    const today = new Date();
    await db.installmentPayment.create({
      data: {
        organizationId: ctx.organizationId,
        installmentId: id,
        amount: paidAmount.toFixed(4),
        paidOn: today,
        markedOn: today,
        companyRegisteredOn: companyRegisteredOn
          ? new Date(companyRegisteredOn)
          : null,
        source: "MANUAL",
        createdById: ctx.userId,
      },
    });
  }
  if (installment.policyId) {
    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "POLICY",
      entityId: installment.policyId,
      action: "installment_status",
      summary: `Cuota ${installment.number} quedó ${INSTALLMENT_STATUS_LABELS[status].toLowerCase()}`,
      userId: ctx.userId,
      metadata: reason?.trim() ? { reason: reason.trim() } : undefined,
    });
    revalidatePath(`/polizas/${installment.policyId}`);
  }
  revalidatePath("/cobranza");
  return { ok: true };
}

export async function markInstallmentPendingAction(
  id: string,
  reason?: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  const installment = await getInstallmentWithPolicy(db, id);
  if (!installment) {
    return { ok: false, error: "La cuota no existe o no tienes acceso." };
  }
  if (!hasPermission(ctx.role, "installments.edit_paid")) {
    return { ok: false, error: "No tienes permiso para revertir pagos." };
  }
  const reasonError = sensitiveReasonError(reason);
  if (reasonError) return { ok: false, error: reasonError };

  await db.installment.update({
    where: { id },
    data: { status: "PENDIENTE", paidAt: null },
  });
  if (installment.policyId) {
    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "POLICY",
      entityId: installment.policyId,
      action: "installment_payment_reverted",
      summary: `Pago de cuota ${installment.number} revertido`,
      userId: ctx.userId,
      metadata: { reason: reason!.trim() },
    });
  }

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
