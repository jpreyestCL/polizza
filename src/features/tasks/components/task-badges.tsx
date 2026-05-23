import { Badge } from "@/components/ui/badge";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "../schemas";

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "muted";

const STATUS_VARIANT: Record<TaskStatusValue, BadgeVariant> = {
  PENDIENTE: "secondary",
  EN_PROGRESO: "default",
  COMPLETADA: "success",
  CANCELADA: "muted",
};

const PRIORITY_VARIANT: Record<TaskPriorityValue, BadgeVariant> = {
  BAJA: "muted",
  MEDIA: "secondary",
  ALTA: "destructive",
};

export function TaskStatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status as TaskStatusValue] ?? "muted";
  const label = TASK_STATUS_LABELS[status as TaskStatusValue] ?? status;
  return <Badge variant={variant}>{label}</Badge>;
}

export function TaskPriorityBadge({ priority }: { priority: string }) {
  const variant = PRIORITY_VARIANT[priority as TaskPriorityValue] ?? "muted";
  const label = TASK_PRIORITY_LABELS[priority as TaskPriorityValue] ?? priority;
  return <Badge variant={variant}>Prioridad {label.toLowerCase()}</Badge>;
}
