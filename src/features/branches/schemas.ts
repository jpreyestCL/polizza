import { z } from "zod";

export const branchFormSchema = z.object({
  name: z.string().trim().min(1, "Nombre de la sucursal requerido").max(160),
  address: z.string().trim().max(200).default(""),
  contactName: z.string().trim().max(160).default(""),
  region: z.string().trim().max(120).default(""),
  commune: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(40).default(""),
  celular: z.string().trim().max(40).default(""),
  email: z
    .union([z.literal(""), z.string().email("Correo inválido")])
    .default(""),
});

export type BranchFormValues = z.infer<typeof branchFormSchema>;
