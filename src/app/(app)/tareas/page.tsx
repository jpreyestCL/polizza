import { requireOrgDb } from "@/server/context";
import { listTasks } from "@/features/tasks/queries";
import { getOrgMembers } from "@/features/clients/queries";
import { TasksView } from "@/features/tasks/components/tasks-view";
import { PageHeader } from "@/components/page-header";

export default async function TareasPage() {
  const { ctx, db } = await requireOrgDb();
  const [tasks, members] = await Promise.all([
    listTasks(ctx, db),
    getOrgMembers(ctx.organizationId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tareas"
        description="Gestión de pendientes y seguimiento del equipo."
      />
      <TasksView tasks={tasks} members={members} />
    </div>
  );
}
