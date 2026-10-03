import { z } from "zod";

export const REQUEST_TYPES = [
  "ACCESS",
  "RECTIFICATION",
  "DELETION",
  "OPPOSITION",
  "PORTABILITY",
  "BLOCKING",
] as const;
export const REQUEST_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
] as const;

export const dataSubjectRequestSchema = z.object({
  clientId: z.string().min(1, "Selecciona un cliente."),
  type: z.enum(REQUEST_TYPES),
  channel: z.string().trim().max(100).optional(),
  requestNote: z.string().trim().max(2000).optional(),
  dueAt: z.coerce.date(),
});

export const requestTransitionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(REQUEST_STATUSES),
  reason: z.string().trim().max(2000).optional(),
});
