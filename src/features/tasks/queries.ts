import "server-only";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import type { SessionContext } from "@/server/context";
import type { Db } from "@/server/db";
import { canSeeAllClients } from "@/lib/roles";
import { isTaskOverdue } from "./overdue";

export type TaskListItem = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  assignedUserId: string | null;
  createdAt: Date;
  overdue: boolean;
};

/** Tareas acotadas por rol: el ejecutivo ve las suyas, gerencia ve todas. */
export async function listTasks(
  ctx: SessionContext,
  db: Db,
): Promise<TaskListItem[]> {
  const rows = await db.task.findMany({
    where: canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      assignedUserId: true,
      createdAt: true,
    },
  });

  return rows.map((task) => ({
    ...task,
    overdue: isTaskOverdue(task.status, task.dueDate),
  }));
}

/** Cantidad de tareas abiertas (para el dashboard). */
export async function countOpenTasks(
  ctx: SessionContext,
  db: Db,
): Promise<{ open: number; overdue: number }> {
  const tasks = await listTasks(ctx, db);
  const openStatuses: TaskStatus[] = ["PENDIENTE", "EN_PROGRESO"];
  return {
    open: tasks.filter((t) => openStatuses.includes(t.status)).length,
    overdue: tasks.filter((t) => t.overdue).length,
  };
}
