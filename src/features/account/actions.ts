"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { APIError } from "better-auth/api";
import { auth } from "@/server/auth";
import { requireSession } from "@/server/context";
import {
  profileNameSchema,
  changePasswordSchema,
  type ProfileNameValues,
  type ChangePasswordValues,
  type AccountResult,
} from "./schemas";

/** Actualiza el nombre visible del usuario de la sesión actual. */
export async function updateProfileNameAction(
  values: ProfileNameValues,
): Promise<AccountResult> {
  const parsed = profileNameSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
  }
  await requireSession();

  try {
    await auth.api.updateUser({
      headers: await headers(),
      body: { name: parsed.data.name },
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { ok: false, error: "No pudimos actualizar tu nombre." };
    }
    throw error;
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Cambia la contraseña del usuario de la sesión actual. Better Auth valida la
 * contraseña actual; si no coincide devuelve 400 y no escribe nada.
 */
export async function changePasswordAction(
  values: ChangePasswordValues,
): Promise<AccountResult> {
  const parsed = changePasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
  }
  await requireSession();

  try {
    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: parsed.data.revokeOtherSessions,
      },
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { ok: false, error: "La contraseña actual no es correcta." };
    }
    throw error;
  }

  return { ok: true };
}
