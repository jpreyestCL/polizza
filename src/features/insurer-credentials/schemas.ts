import { z } from "zod";

export const credentialFormSchema = z.object({
  insurerKey: z.string().min(1, "Selecciona una aseguradora"),
  username: z.string().trim().min(1, "Usuario requerido").max(160),
  password: z.string().min(1, "Contraseña requerida").max(200),
  notes: z.string().trim().max(500).default(""),
});

export type CredentialFormValues = z.infer<typeof credentialFormSchema>;
