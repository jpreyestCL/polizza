"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { logActivity } from "@/server/activity";
import { canDeleteClaim } from "@/lib/roles";
import {
  claimFormSchema,
  claimStatusChangeSchema,
  CLAIM_STATUS_LABELS,
  type ClaimFormValues,
  type ClaimStatusChangeValues,
} from "./schemas";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function amount(value: string): string | null {
  return value === "" ? null : value;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function createClaimAction(
  values: ClaimFormValues,
): Promise<ActionResult> {
  const parsed = claimFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const client = await db.client.findFirst({
    where: { id: data.clientId },
    select: { id: true, name: true },
  });
  if (!client) {
    return {
      ok: false,
      error: "El cliente seleccionado no existe.",
      fieldErrors: { clientId: "Cliente inválido" },
    };
  }

  try {
    const claim = await db.$transaction(async (tx) => {
      const count = await tx.claim.count();
      const claimNumber = `S-${new Date().getFullYear()}-${String(
        count + 1,
      ).padStart(4, "0")}`;
      const created = await tx.claim.create({
        data: {
          organizationId: ctx.organizationId,
          clientId: data.clientId,
          policyId: emptyToNull(data.policyId),
          claimNumber,
          description: data.description,
          occurredAt: parseDate(data.occurredAt),
          reportedAt: parseDate(data.reportedAt),
          status: "REPORTADO",
          estimatedAmount: amount(data.estimatedAmount),
          settledAmount: amount(data.settledAmount),
          currency: data.currency,
          assignedUserId: emptyToNull(data.assignedUserId) ?? ctx.userId,
          currentStateStartedAt: new Date(),
          createdById: ctx.userId,
        },
      });
      await tx.claimStatusHistory.create({
        data: {
          organizationId: ctx.organizationId,
          claimId: created.id,
          status: "REPORTADO",
          note: "Siniestro reportado",
          changedById: ctx.userId,
        },
      });
      return created;
    });

    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "CLAIM",
      entityId: claim.id,
      action: "created",
      summary: `Siniestro ${claim.claimNumber} reportado para ${client.name}`,
      userId: ctx.userId,
    });

    revalidatePath("/siniestros");
    return { ok: true, id: claim.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Conflicto al numerar el siniestro. Intenta nuevamente.",
      };
    }
    throw error;
  }
}

export async function updateClaimAction(
  id: string,
  values: ClaimFormValues,
): Promise<ActionResult> {
  const parsed = claimFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const existing = await db.claim.findFirst({ where: { id } });
  if (!existing) {
    return { ok: false, error: "El siniestro no existe o no tienes acceso." };
  }
  const client = await db.client.findFirst({
    where: { id: data.clientId },
    select: { id: true },
  });
  if (!client) {
    return {
      ok: false,
      error: "El cliente seleccionado no existe.",
      fieldErrors: { clientId: "Cliente inválido" },
    };
  }

  await db.claim.update({
    where: { id },
    data: {
      clientId: data.clientId,
      policyId: emptyToNull(data.policyId),
      description: data.description,
      occurredAt: parseDate(data.occurredAt),
      reportedAt: parseDate(data.reportedAt),
      estimatedAmount: amount(data.estimatedAmount),
      settledAmount: amount(data.settledAmount),
      currency: data.currency,
      assignedUserId: emptyToNull(data.assignedUserId) ?? ctx.userId,
    },
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLAIM",
    entityId: id,
    action: "updated",
    summary: `Siniestro ${existing.claimNumber} actualizado`,
    userId: ctx.userId,
  });

  revalidatePath("/siniestros");
  revalidatePath(`/siniestros/${id}`);
  return { ok: true, id };
}

export async function changeClaimStatusAction(
  id: string,
  values: ClaimStatusChangeValues,
): Promise<ActionResult> {
  const parsed = claimStatusChangeSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Datos de cambio de estado inválidos." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const claim = await db.claim.findFirst({
    where: { id },
    select: { id: true, status: true, claimNumber: true },
  });
  if (!claim) {
    return { ok: false, error: "El siniestro no existe o no tienes acceso." };
  }
  if (claim.status === data.status) {
    return { ok: false, error: "El siniestro ya está en ese estado." };
  }

  await db.$transaction(async (tx) => {
    await tx.claim.update({
      where: { id },
      data: { status: data.status, currentStateStartedAt: new Date() },
    });
    await tx.claimStatusHistory.create({
      data: {
        organizationId: ctx.organizationId,
        claimId: id,
        status: data.status,
        note: emptyToNull(data.note),
        changedById: ctx.userId,
      },
    });
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLAIM",
    entityId: id,
    action: "status_changed",
    summary: `Siniestro ${claim.claimNumber}: ${CLAIM_STATUS_LABELS[data.status]}`,
    userId: ctx.userId,
  });

  revalidatePath("/siniestros");
  revalidatePath(`/siniestros/${id}`);
  return { ok: true, id };
}

export async function deleteClaimAction(id: string): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!canDeleteClaim(ctx.role)) {
    return { ok: false, error: "No tienes permiso para eliminar siniestros." };
  }

  const existing = await db.claim.findFirst({
    where: { id },
    select: { id: true, claimNumber: true },
  });
  if (!existing) {
    return { ok: false, error: "El siniestro no existe o no tienes acceso." };
  }

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLAIM",
    entityId: id,
    action: "deleted",
    summary: `Siniestro ${existing.claimNumber} eliminado`,
    userId: ctx.userId,
  });
  await db.claim.delete({ where: { id } });

  revalidatePath("/siniestros");
  return { ok: true, id };
}
