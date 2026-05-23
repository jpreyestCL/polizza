import { z } from "zod";

const optionalString = z.string().trim().default("");
const optionalAmount = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0),
    "Monto inválido",
  )
  .default("");

export const tenantCoverageFormSchema = z.object({
  order: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Number(v)), "Orden inválido")
    .default(""),
  name: z.string().trim().min(1, "Nombre requerido"),
  factor: optionalAmount,
  polCad: optionalString,
  text: optionalString,
  isCommercialValue: z.boolean().default(false),
  insuredAmount: optionalAmount,
  type: z.enum(["COBERTURA", "ADICIONAL"]).default("COBERTURA"),
  affectedByIva: z.boolean().default(false),
  sumsToTotal: z.boolean().default(true),
  premium: optionalAmount,
});

export type TenantCoverageFormValues = z.infer<typeof tenantCoverageFormSchema>;
