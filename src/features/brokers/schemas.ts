import { z } from "zod";

const optionalString = z.string().trim().default("");

export const brokerFormSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  rut: optionalString,
  email: optionalString,
  phone: optionalString,
  contactName: optionalString,
  address: optionalString,
  isActive: z.boolean().default(true),
});

export type BrokerFormValues = z.infer<typeof brokerFormSchema>;
