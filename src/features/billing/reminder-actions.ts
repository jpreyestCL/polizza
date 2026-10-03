"use server";

import { Prisma, type CollectionReminderKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/factory-roles";
import { requireOrgDb } from "@/server/context";
import { emailLayout, sendEmail } from "@/server/email";
import { logAudit } from "@/server/activity";
import {
  classifyCollectionReminder,
  localDateKey,
  reminderDedupeKey,
} from "./reminders";

export type ReminderResult =
  | { ok: true; sent: number; skipped: number }
  | { ok: false; error: string };

const LABELS: Record<CollectionReminderKind, string> = {
  ADVANCE: "próximo vencimiento",
  OVERDUE: "cuota vencida",
  REJECTED: "pago rechazado",
  LAPSE: "riesgo de término por no pago",
};

async function sendOne(id: string): Promise<ReminderResult> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "collections.send_reminders")) {
    return { ok: false, error: "No tienes permiso para enviar recordatorios." };
  }
  const installment = await db.installment.findFirst({
    where: { id, policyId: { not: null } },
    select: {
      id: true,
      number: true,
      amount: true,
      currency: true,
      dueDate: true,
      status: true,
      policy: {
        select: {
          policyNumber: true,
          client: { select: { name: true, email: true } },
          proposal: { select: { paymentPlan: { select: { payerEmail: true } } } },
        },
      },
    },
  });
  if (!installment?.policy) {
    return { ok: false, error: "La cuota no existe o no tiene póliza." };
  }
  const kind = classifyCollectionReminder(
    installment.status,
    installment.dueDate,
  );
  if (!kind) {
    return { ok: false, error: "La cuota no requiere un recordatorio hoy." };
  }
  const to =
    installment.policy.proposal?.paymentPlan?.payerEmail ??
    installment.policy.client.email;
  if (!to) {
    return { ok: false, error: "El pagador y el cliente no tienen email." };
  }
  const dedupeKey = reminderDedupeKey(
    id,
    kind,
    localDateKey(new Date(), ctx.organizationTimezone),
  );
  const subject = `Recordatorio de cobranza: ${LABELS[kind]}`;
  try {
    await db.collectionReminder.create({
      data: {
        organizationId: ctx.organizationId,
        installmentId: id,
        kind,
        sentTo: to,
        subject,
        sentById: ctx.userId,
        dedupeKey,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: true, sent: 0, skipped: 1 };
    }
    throw error;
  }
  try {
    const detail = `Póliza ${installment.policy.policyNumber}, cuota ${installment.number}, monto ${installment.currency} ${Number(installment.amount).toLocaleString("es-CL")}.`;
    await sendEmail({
      to,
      subject,
      text: `${installment.policy.client.name}: ${detail}`,
      html: emailLayout(subject, `${installment.policy.client.name}: ${detail}`),
    });
  } catch (error) {
    await db.collectionReminder.deleteMany({ where: { dedupeKey } });
    throw error;
  }
  await logAudit({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "collection_reminder_sent",
    metadata: { installmentId: id, kind, sentTo: to },
  });
  return { ok: true, sent: 1, skipped: 0 };
}

export async function sendCollectionReminderAction(
  installmentId: string,
): Promise<ReminderResult> {
  const result = await sendOne(installmentId);
  revalidatePath("/cobranza");
  return result;
}

export async function sendCollectionRemindersBatchAction(): Promise<void> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "collections.send_reminders")) {
    redirect("/cobranza?aviso=permiso");
  }
  const candidates = await db.installment.findMany({
    where: {
      policyId: { not: null },
      status: { in: ["PENDIENTE", "PARCIAL", "RECHAZADA"] },
      dueDate: { lte: new Date(Date.now() + 7 * 86_400_000) },
    },
    select: { id: true },
    take: 500,
  });
  let sent = 0;
  let skipped = 0;
  for (const candidate of candidates) {
    const result = await sendOne(candidate.id);
    if (result.ok) {
      sent += result.sent;
      skipped += result.skipped;
    } else {
      skipped += 1;
    }
  }
  revalidatePath("/cobranza");
  redirect(`/cobranza?recordatorios=${sent}&omitidos=${skipped}`);
}
