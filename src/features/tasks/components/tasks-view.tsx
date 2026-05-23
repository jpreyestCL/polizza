"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Pencil, Plus } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { changeTaskStatusAction } from "../actions";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskStatusValue,
} from "../schemas";
import type { TaskListItem } from "../queries";
import type { OrgMember } from "@/features/clients/queries";
import { TaskPriorityBadge } from "./task-badges";
import { TaskDialog } from "./task-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Filter = "ALL" | TaskStatusValue;

export function TasksView({
  tasks,
  members,
}: {
  tasks: TaskListItem[];
  members: OrgMember[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaskListItem | null>(null);

  const memberName = new Map(members.map((m) => [m.userId, m.name]));
  const visible =
    filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter);

  async function quickStatus(taskId: string, status: TaskStatusValue) {
    const result = await changeTaskStatusAction(taskId, status);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Estado actualizado");
    router.refresh();
  }

  const filters: { value: Filter; label: string }[] = [
    { value: "ALL", label: "Todas" },
    ...TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={filter === option.value ? "default" : "outline"}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </Button>
        ))}
        <div className="ml-auto">
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            Nueva tarea
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sin tareas"
          description="No hay tareas que coincidan con el filtro seleccionado."
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((task) => {
            const closed =
              task.status === "COMPLETADA" || task.status === "CANCELADA";
            return (
              <li
                key={task.id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "font-medium",
                        closed && "text-muted-foreground line-through",
                      )}
                    >
                      {task.title}
                    </span>
                    <TaskPriorityBadge priority={task.priority} />
                  </div>
                  {task.description && (
                    <p className="truncate text-sm text-muted-foreground">
                      {task.description}
                    </p>
                  )}
                  <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {task.dueDate && (
                      <span
                        className={cn(
                          task.overdue && "font-medium text-destructive",
                        )}
                      >
                        Vence el {formatDate(task.dueDate)}
                        {task.overdue && " · vencida"}
                      </span>
                    )}
                    {task.assignedUserId &&
                      memberName.has(task.assignedUserId) && (
                        <span>{memberName.get(task.assignedUserId)}</span>
                      )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={task.status}
                    onValueChange={(value) =>
                      quickStatus(task.id, value as TaskStatusValue)
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {TASK_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Editar tarea"
                    onClick={() => {
                      setEditing(task);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        members={members}
      />
    </div>
  );
}
