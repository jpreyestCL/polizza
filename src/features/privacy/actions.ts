"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/factory-roles";
import { sensitiveReasonError } from "@/lib/domain/sensitive-reason";
import { logAudit } from "@/server/activity";
import { requireOrgDb } from "@/server/context";
import {
  dataSubjectRequestSchema,
  requestTransitionSchema,
} from "./schemas";

export async function createPrivacyRequestAction(formData: FormData) {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "privacy.manage")) return;
  const parsed = dataSubjectRequestSchema.safeParse({
    clientId: formData.get("clientId"),
    type: formData.get("type"),
    channel: formData.get("channel"),
    requestNote: formData.get("requestNote"),
    dueAt: formData.get("dueAt"),
  });
  if (!parsed.success) return;
  const client = await db.client.findFirst({
    where: { id: parsed.data.clientId },
    select: { id: true },
  });
  if (!client) return;
  const request = await db.dataSubjectRequest.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: client.id,
      type: parsed.data.type,
      channel: parsed.data.channel || null,
      requestNote: parsed.data.requestNote || null,
      dueAt: parsed.data.dueAt,
      createdById: ctx.userId,
    },
  });
  await logAudit({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "privacy_request_created",
    metadata: { requestId: request.id, clientId: client.id, type: request.type },
  });
  revalidatePath("/privacidad");
}

export async function transitionPrivacyRequestAction(formData: FormData) {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "privacy.manage")) return;
  const parsed = requestTransitionSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return;
  if (
    ["COMPLETED", "REJECTED"].includes(parsed.data.status) &&
    sensitiveReasonError(parsed.data.reason)
  ) {
    return;
  }
  const existing = await db.dataSubjectRequest.findFirst({
    where: { id: parsed.data.id },
    select: { id: true, clientId: true, status: true },
  });
  if (!existing) return;
  await db.dataSubjectRequest.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status,
      handledById: ctx.userId,
      completedAt:
        parsed.data.status === "COMPLETED" ||
        parsed.data.status === "REJECTED"
          ? new Date()
          : null,
      resolutionNote: parsed.data.reason || null,
      sensitiveReason:
        parsed.data.status === "COMPLETED" ||
        parsed.data.status === "REJECTED"
          ? parsed.data.reason
          : null,
    },
  });
  await logAudit({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "privacy_request_transitioned",
    metadata: {
      requestId: existing.id,
      from: existing.status,
      to: parsed.data.status,
      reason: parsed.data.reason,
    },
  });
  revalidatePath("/privacidad");
}
