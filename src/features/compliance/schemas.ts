import { z } from "zod";

export const complianceObligationSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  dueDate: z.coerce.date(),
  assignedUserId: z.string().trim().optional(),
});

export const complianceResolutionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["DONE", "WAIVED"]),
  reason: z.string().trim().min(10, "El motivo debe tener al menos 10 caracteres."),
});
