import { z } from "zod";

/** Largo mínimo de contraseña; debe coincidir con `emailAndPassword` en auth.ts. */
export const MIN_PASSWORD_LENGTH = 8;

export const profileNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "El nombre no puede superar los 80 caracteres"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
    newPassword: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
      ),
    confirmPassword: z.string(),
    revokeOtherSessions: z.boolean().default(true),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "La nueva contraseña debe ser distinta de la actual",
  });

export const changeEmailSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Ingresa el correo nuevo")
    .email("Correo inválido"),
});

export type ProfileNameValues = z.infer<typeof profileNameSchema>;
export type ChangeEmailValues = z.infer<typeof changeEmailSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export type AccountResult = { ok: true } | { ok: false; error: string };
