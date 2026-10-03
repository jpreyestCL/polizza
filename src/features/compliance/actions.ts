"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/factory-roles";
import { logAudit } from "@/server/activity";
import { requireOrgDb } from "@/server/context";
import {
  complianceObligationSchema,
  complianceResolutionSchema,
} from "./schemas";

function allowed(role: string) {
  return hasPermission(role, "compliance.manage");
}

export async function saveComplianceObligationAction(formData: FormData) {
  const { ctx, db } = await requireOrgDb();
  if (!allowed(ctx.role)) return;
  const parsed = complianceObligationSchema.safeParse({
    id: formData.get("id") || undefined,
    code: formData.get("code"),
    title: formData.get("title"),
    description: formData.get("description"),
    dueDate: formData.get("dueDate"),
    assignedUserId: formData.get("assignedUserId"),
  });
  if (!parsed.success) return;
  const data = {
    code: parsed.data.code,
    title: parsed.data.title,
    description: parsed.data.description || null,
    dueDate: parsed.data.dueDate,
    assignedUserId: parsed.data.assignedUserId || null,
  };
  let id = parsed.data.id;
  if (id) {
    const existing = await db.complianceObligation.findFirst({ where: { id } });
    if (!existing) return;
    await db.complianceObligation.update({ where: { id }, data });
  } else {
    const created = await db.complianceObligation.create({
      data: {
        organizationId: ctx.organizationId,
        ...data,
        createdById: ctx.userId,
      },
    });
    id = created.id;
  }
  await logAudit({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: parsed.data.id
      ? "compliance_obligation_updated"
      : "compliance_obligation_created",
    metadata: { obligationId: id },
  });
  revalidatePath("/cumplimiento");
}

export async function resolveComplianceObligationAction(formData: FormData) {
  const { ctx, db } = await requireOrgDb();
  if (!allowed(ctx.role)) return;
  const parsed = complianceResolutionSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return;
  const existing = await db.complianceObligation.findFirst({
    where: { id: parsed.data.id },
    select: { id: true, status: true },
  });
  if (!existing) return;
  await db.complianceObligation.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status,
      completedAt: new Date(),
      completedNote: parsed.data.reason,
    },
  });
  await logAudit({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "compliance_obligation_resolved",
    metadata: {
      obligationId: existing.id,
      from: existing.status,
      to: parsed.data.status,
      reason: parsed.data.reason,
    },
  });
  revalidatePath("/cumplimiento");
}

export async function deleteComplianceObligationAction(formData: FormData) {
  const { ctx, db } = await requireOrgDb();
  if (!allowed(ctx.role)) return;
  const id = String(formData.get("id") ?? "");
  const existing = await db.complianceObligation.findFirst({ where: { id } });
  if (!existing) return;
  await db.complianceObligation.delete({ where: { id } });
  await logAudit({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "compliance_obligation_deleted",
    metadata: { obligationId: id, code: existing.code },
  });
  revalidatePath("/cumplimiento");
}
