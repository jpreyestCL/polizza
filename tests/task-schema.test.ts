import { describe, it, expect } from "vitest";
import { taskFormSchema } from "@/features/tasks/schemas";
import { isTaskOverdue } from "@/features/tasks/overdue";

const baseTask = {
  title: "Llamar al cliente",
  description: "",
  priority: "MEDIA" as const,
  status: "PENDIENTE" as const,
  dueDate: "",
  assignedUserId: "",
};

describe("taskFormSchema", () => {
  it("acepta una tarea válida", () => {
    expect(taskFormSchema.safeParse(baseTask).success).toBe(true);
  });

  it("exige un título", () => {
    expect(
      taskFormSchema.safeParse({ ...baseTask, title: "" }).success,
    ).toBe(false);
  });

  it("rechaza una prioridad inválida", () => {
    expect(
      taskFormSchema.safeParse({ ...baseTask, priority: "URGENTE" }).success,
    ).toBe(false);
  });
});

describe("isTaskOverdue", () => {
  const past = new Date(Date.now() - 3 * 86_400_000);
  const future = new Date(Date.now() + 3 * 86_400_000);

  it("marca vencida una tarea abierta con fecha pasada", () => {
    expect(isTaskOverdue("PENDIENTE", past)).toBe(true);
  });

  it("no marca vencida una tarea completada", () => {
    expect(isTaskOverdue("COMPLETADA", past)).toBe(false);
  });

  it("no marca vencida una tarea con fecha futura", () => {
    expect(isTaskOverdue("EN_PROGRESO", future)).toBe(false);
  });

  it("no marca vencida una tarea sin fecha límite", () => {
    expect(isTaskOverdue("PENDIENTE", null)).toBe(false);
  });
});
