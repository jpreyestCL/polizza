"use server";

import { revalidatePath } from "next/cache";
import { requireOrgDb } from "@/server/context";
import { logActivity } from "@/server/activity";
import {
  taskFormSchema,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskFormValues,
  type TaskStatusValue,
} from "./schemas";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function createTaskAction(
  values: TaskFormValues,
): Promise<ActionResult> {
  const parsed = taskFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos de la tarea." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const task = await db.task.create({
    data: {
      organizationId: ctx.organizationId,
      title: data.title,
      description: emptyToNull(data.description),
      priority: data.priority,
      status: data.status,
      dueDate: parseDate(data.dueDate),
      assignedUserId: emptyToNull(data.assignedUserId) ?? ctx.userId,
      createdById: ctx.userId,
    },
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "TASK",
    entityId: task.id,
    action: "created",
    summary: `Tarea creada: ${task.title}`,
    userId: ctx.userId,
  });

  revalidatePath("/tareas");
  revalidatePath("/panel");
  return { ok: true, id: task.id };
}

export async function updateTaskAction(
  id: string,
  values: TaskFormValues,
): Promise<ActionResult> {
  const parsed = taskFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos de la tarea." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const existing = await db.task.findFirst({ where: { id } });
  if (!existing) {
    return { ok: false, error: "La tarea no existe o no tienes acceso." };
  }

  await db.task.update({
    where: { id },
    data: {
      title: data.title,
      description: emptyToNull(data.description),
      priority: data.priority,
      status: data.status,
      dueDate: parseDate(data.dueDate),
      assignedUserId: emptyToNull(data.assignedUserId) ?? ctx.userId,
    },
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "TASK",
    entityId: id,
    action: "updated",
    summary: `Tarea actualizada: ${data.title}`,
    userId: ctx.userId,
  });

  revalidatePath("/tareas");
  revalidatePath("/panel");
  return { ok: true, id };
}

export async function changeTaskStatusAction(
  id: string,
  status: TaskStatusValue,
): Promise<ActionResult> {
  if (!TASK_STATUSES.includes(status)) {
    return { ok: false, error: "Estado de tarea inválido." };
  }
  const { ctx, db } = await requireOrgDb();

  const task = await db.task.findFirst({
    where: { id },
    select: { id: true, title: true },
  });
  if (!task) {
    return { ok: false, error: "La tarea no existe o no tienes acceso." };
  }

  await db.task.update({ where: { id }, data: { status } });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "TASK",
    entityId: id,
    action: "status_changed",
    summary: `Tarea "${task.title}": ${TASK_STATUS_LABELS[status]}`,
    userId: ctx.userId,
  });

  revalidatePath("/tareas");
  revalidatePath("/panel");
  return { ok: true, id };
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();

  const existing = await db.task.findFirst({
    where: { id },
    select: { id: true, title: true },
  });
  if (!existing) {
    return { ok: false, error: "La tarea no existe o no tienes acceso." };
  }

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "TASK",
    entityId: id,
    action: "deleted",
    summary: `Tarea eliminada: ${existing.title}`,
    userId: ctx.userId,
  });
  await db.task.delete({ where: { id } });

  revalidatePath("/tareas");
  revalidatePath("/panel");
  return { ok: true, id };
}
