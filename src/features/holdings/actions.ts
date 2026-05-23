"use server";

import { revalidatePath } from "next/cache";
import { requireOrgDb } from "@/server/context";
import { logActivity } from "@/server/activity";
import { holdingFormSchema, type HoldingFormValues } from "./schemas";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function createHoldingAction(
  values: HoldingFormValues,
): Promise<ActionResult> {
  const parsed = holdingFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del holding." };
  }
  const { ctx, db } = await requireOrgDb();
  const holding = await db.holding.create({
    data: {
      organizationId: ctx.organizationId,
      name: parsed.data.name,
      notes: emptyToNull(parsed.data.notes),
      createdById: ctx.userId,
    },
  });
  revalidatePath("/holdings");
  return { ok: true, id: holding.id };
}

export async function updateHoldingAction(
  id: string,
  values: HoldingFormValues,
): Promise<ActionResult> {
  const parsed = holdingFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del holding." };
  }
  const { db } = await requireOrgDb();
  const existing = await db.holding.findFirst({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, error: "El holding no existe o no tienes acceso." };
  }
  await db.holding.update({
    where: { id },
    data: {
      name: parsed.data.name,
      notes: emptyToNull(parsed.data.notes),
    },
  });
  revalidatePath("/holdings");
  revalidatePath(`/holdings/${id}`);
  return { ok: true, id };
}

export async function deleteHoldingAction(
  id: string,
): Promise<ActionResult> {
  const { db } = await requireOrgDb();
  const existing = await db.holding.findFirst({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, error: "El holding no existe o no tienes acceso." };
  }
  // Los clientes quedan sin holding (relación opcional, SetNull).
  await db.holding.delete({ where: { id } });
  revalidatePath("/holdings");
  return { ok: true, id };
}

export async function addClientToHoldingAction(
  holdingId: string,
  clientId: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  const holding = await db.holding.findFirst({
    where: { id: holdingId },
    select: { id: true, name: true },
  });
  if (!holding) {
    return { ok: false, error: "El holding no existe o no tienes acceso." };
  }
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { id: true },
  });
  if (!client) {
    return { ok: false, error: "El cliente no existe o no tienes acceso." };
  }

  await db.client.update({
    where: { id: clientId },
    data: { holdingId },
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLIENT",
    entityId: clientId,
    action: "holding_added",
    summary: `Cliente agregado al holding ${holding.name}`,
    userId: ctx.userId,
  });

  revalidatePath("/holdings");
  revalidatePath(`/holdings/${holdingId}`);
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, id: clientId };
}

export async function removeClientFromHoldingAction(
  clientId: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { id: true, holdingId: true },
  });
  if (!client) {
    return { ok: false, error: "El cliente no existe o no tienes acceso." };
  }

  await db.client.update({
    where: { id: clientId },
    data: { holdingId: null },
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLIENT",
    entityId: clientId,
    action: "holding_removed",
    summary: "Cliente retirado de su holding",
    userId: ctx.userId,
  });

  revalidatePath("/holdings");
  if (client.holdingId) {
    revalidatePath(`/holdings/${client.holdingId}`);
  }
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, id: clientId };
}
