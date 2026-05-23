import type { TaskStatus } from "@prisma/client";

function startOfUtcDay(date: Date): number {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

/** Una tarea está vencida si su fecha límite ya pasó y sigue abierta. */
export function isTaskOverdue(
  status: TaskStatus,
  dueDate: Date | null,
): boolean {
  if (!dueDate || status === "COMPLETADA" || status === "CANCELADA") {
    return false;
  }
  return startOfUtcDay(dueDate) < startOfUtcDay(new Date());
}
