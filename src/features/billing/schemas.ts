import { z } from "zod";

export const INSTALLMENT_STATUSES = [
  "PENDIENTE",
  "PAGADA",
  "ANULADA",
] as const;

export type InstallmentStatusValue = (typeof INSTALLMENT_STATUSES)[number];

export const INSTALLMENT_STATUS_LABELS: Record<
  InstallmentStatusValue,
  string
> = {
  PENDIENTE: "Pendiente",
  PAGADA: "Pagada",
  ANULADA: "Anulada",
};

export const generatePlanSchema = z.object({
  count: z
    .string()
    .trim()
    .refine((value) => {
      const n = Number(value);
      return Number.isInteger(n) && n >= 1 && n <= 36;
    }, "Entre 1 y 36 cuotas"),
  amount: z
    .string()
    .trim()
    .refine(
      (value) => !Number.isNaN(Number(value)) && Number(value) > 0,
      "Ingresa un monto válido",
    ),
  firstDueDate: z
    .string()
    .min(1, "Selecciona la fecha de la primera cuota"),
  currency: z.enum(["UF", "CLP", "USD", "USD_OBS", "EUR", "UD"]),
});

export type GeneratePlanValues = z.infer<typeof generatePlanSchema>;
