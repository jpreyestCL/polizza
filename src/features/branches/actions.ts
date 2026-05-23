"use server";

import { revalidatePath } from "next/cache";
import { requireOrgDb } from "@/server/context";
import { logActivity } from "@/server/activity";
import { branchFormSchema, type BranchFormValues } from "./schemas";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function createBranchAction(
  clientId: string,
  values: BranchFormValues,
): Promise<ActionResult> {
  const parsed = branchFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos de la sucursal." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { id: true },
  });
  if (!client) {
    return { ok: false, error: "El cliente no existe o no tienes acceso." };
  }

  const branch = await db.branch.create({
    data: {
      organizationId: ctx.organizationId,
      clientId,
      name: data.name,
      address: emptyToNull(data.address),
      contactName: emptyToNull(data.contactName),
      region: emptyToNull(data.region),
      commune: emptyToNull(data.commune),
      phone: emptyToNull(data.phone),
      celular: emptyToNull(data.celular),
      email: emptyToNull(data.email),
    },
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLIENT",
    entityId: clientId,
    action: "branch_added",
    summary: `Sucursal agregada: ${data.name}`,
    userId: ctx.userId,
  });

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, id: branch.id };
}

export async function updateBranchAction(
  id: string,
  values: BranchFormValues,
): Promise<ActionResult> {
  const parsed = branchFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos de la sucursal." };
  }
  const data = parsed.data;
  const { db } = await requireOrgDb();

  const existing = await db.branch.findFirst({
    where: { id },
    select: { id: true, clientId: true },
  });
  if (!existing) {
    return { ok: false, error: "La sucursal no existe o no tienes acceso." };
  }

  await db.branch.update({
    where: { id },
    data: {
      name: data.name,
      address: emptyToNull(data.address),
      contactName: emptyToNull(data.contactName),
      region: emptyToNull(data.region),
      commune: emptyToNull(data.commune),
      phone: emptyToNull(data.phone),
      celular: emptyToNull(data.celular),
      email: emptyToNull(data.email),
    },
  });

  revalidatePath(`/clientes/${existing.clientId}`);
  return { ok: true, id };
}

export async function deleteBranchAction(id: string): Promise<ActionResult> {
  const { db } = await requireOrgDb();
  const existing = await db.branch.findFirst({
    where: { id },
    select: { id: true, clientId: true },
  });
  if (!existing) {
    return { ok: false, error: "La sucursal no existe o no tienes acceso." };
  }
  await db.branch.delete({ where: { id } });
  revalidatePath(`/clientes/${existing.clientId}`);
  return { ok: true, id };
}
