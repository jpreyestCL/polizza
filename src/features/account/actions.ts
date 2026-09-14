"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { APIError } from "better-auth/api";
import { auth } from "@/server/auth";
import { requireSession } from "@/server/context";
import {
  profileNameSchema,
  changePasswordSchema,
  changeEmailSchema,
  type ProfileNameValues,
  type ChangePasswordValues,
  type ChangeEmailValues,
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

/**
 * Pide el cambio de correo. Better Auth no toca el correo todavía: manda un
 * enlace de confirmación a la dirección NUEVA y el cambio se escribe recién
 * cuando el usuario lo abre.
 *
 * Si el correo ya pertenece a otra cuenta, Better Auth responde 200 sin enviar
 * nada, para no revelar qué direcciones están registradas. Por eso el mensaje
 * de vuelta es deliberadamente neutro y no confirma la existencia del correo.
 */
export async function requestEmailChangeAction(
  values: ChangeEmailValues,
): Promise<AccountResult> {
  const parsed = changeEmailSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
  }
  const ctx = await requireSession();

  if (parsed.data.newEmail === ctx.email.toLowerCase()) {
    return { ok: false, error: "Ese ya es tu correo actual." };
  }

  try {
    await auth.api.changeEmail({
      headers: await headers(),
      body: {
        newEmail: parsed.data.newEmail,
        callbackURL: "/perfil?correo=confirmado",
      },
    });
  } catch (error) {
    if (error instanceof APIError) {
      return {
        ok: false,
        error: "No pudimos iniciar el cambio de correo. Inténtalo de nuevo.",
      };
    }
    throw error;
  }

  return { ok: true };
}
