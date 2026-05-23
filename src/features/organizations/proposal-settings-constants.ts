import { z } from "zod";

/** Lista controlada de zonas horarias chilenas / regionales habituales. */
export const SUPPORTED_TIMEZONES = [
  "America/Santiago",
  "Pacific/Easter",
  "America/Punta_Arenas",
  "America/Argentina/Buenos_Aires",
  "America/Lima",
  "America/Bogota",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/Madrid",
  "UTC",
] as const;

export const proposalSettingsSchema = z.object({
  reservaDays: z.coerce.number().int().min(1).max(365),
  proposalNumberPattern: z
    .string()
    .trim()
    .min(1, "Patrón requerido")
    .refine(
      (p) => p.includes("{SEQ"),
      "El patrón debe incluir un token {SEQ} o {SEQ:NNNN}",
    ),
  timezone: z
    .string()
    .trim()
    .min(1, "Selecciona una zona horaria")
    .default("America/Santiago"),
});

export type ProposalSettingsValues = z.infer<typeof proposalSettingsSchema>;

export type ProposalSettingsResult =
  | { ok: true }
  | { ok: false; error: string };
