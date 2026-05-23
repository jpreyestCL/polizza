import { z } from "zod";

export const holdingFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(160),
  notes: z.string().trim().max(2000).default(""),
});

export type HoldingFormValues = z.infer<typeof holdingFormSchema>;
