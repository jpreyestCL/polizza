"use server";

import { revalidatePath } from "next/cache";
import { requireOrgDb } from "@/server/context";
import { logActivity } from "@/server/activity";
import { encryptSecret, isCryptoConfigured } from "@/lib/insurer-crypto";
import { getInsurerAdapter } from "@/features/car-quotes/insurers/registry";
import { credentialFormSchema, type CredentialFormValues } from "./schemas";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function upsertCredentialAction(
  values: CredentialFormValues,
): Promise<ActionResult> {
  const parsed = credentialFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();
  if (ctx.role !== "admin") {
    return {
      ok: false,
      error: "Solo administradores pueden configurar credenciales.",
    };
  }
  const adapter = getInsurerAdapter(data.insurerKey);
  if (!adapter) {
    return { ok: false, error: "Aseguradora no soportada." };
  }
  if (!isCryptoConfigured()) {
    return {
      ok: false,
      error:
        "Falta configurar QUOTE_CREDENTIALS_KEY en el entorno antes de guardar credenciales.",
    };
  }

  const enc = encryptSecret(data.password);
  const existing = await db.insurerPortalCredential.findFirst({
    where: { insurerKey: data.insurerKey },
    select: { id: true },
  });

  let id: string;
  if (existing) {
    const updated = await db.insurerPortalCredential.update({
      where: { id: existing.id },
      data: {
        username: data.username,
        passwordEncrypted: enc.ciphertext,
        passwordIv: enc.iv,
        passwordTag: enc.tag,
        notes: data.notes || null,
        status: "ACTIVA",
        insurerName: adapter.name,
      },
    });
    id = updated.id;
  } else {
    const created = await db.insurerPortalCredential.create({
      data: {
        organizationId: ctx.organizationId,
        insurerKey: data.insurerKey,
        insurerName: adapter.name,
        username: data.username,
        passwordEncrypted: enc.ciphertext,
        passwordIv: enc.iv,
        passwordTag: enc.tag,
        notes: data.notes || null,
        createdById: ctx.userId,
      },
    });
    id = created.id;
  }

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLIENT", // sin entidad propia; usamos un evento "config"
    entityId: id,
    action: "insurer_credential_saved",
    summary: `Credencial del portal ${adapter.name} ${existing ? "actualizada" : "creada"}`,
    userId: ctx.userId,
    metadata: { insurerKey: data.insurerKey },
  });

  revalidatePath("/configuracion/portales");
  return { ok: true, id };
}

export async function deleteCredentialAction(
  id: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (ctx.role !== "admin") {
    return { ok: false, error: "No autorizado." };
  }
  const existing = await db.insurerPortalCredential.findFirst({
    where: { id },
    select: { id: true, insurerName: true },
  });
  if (!existing) {
    return { ok: false, error: "Credencial no encontrada." };
  }
  await db.insurerPortalCredential.delete({ where: { id } });
  revalidatePath("/configuracion/portales");
  return { ok: true, id };
}
