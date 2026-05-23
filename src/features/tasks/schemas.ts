import { z } from "zod";

export const TASK_STATUSES = [
  "PENDIENTE",
  "EN_PROGRESO",
  "COMPLETADA",
  "CANCELADA",
] as const;

export type TaskStatusValue = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatusValue, string> = {
  PENDIENTE: "Pendiente",
  EN_PROGRESO: "En progreso",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

export const TASK_PRIORITIES = ["BAJA", "MEDIA", "ALTA"] as const;

export type TaskPriorityValue = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriorityValue, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
};

export const taskFormSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  description: z.string().trim().max(2000).default(""),
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(TASK_STATUSES),
  dueDate: z.string().default(""),
  assignedUserId: z.string().default(""),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;
