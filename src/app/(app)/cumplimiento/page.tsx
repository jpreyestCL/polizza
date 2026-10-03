import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import {
  deleteComplianceObligationAction,
  resolveComplianceObligationAction,
  saveComplianceObligationAction,
} from "@/features/compliance/actions";
import { listComplianceObligations } from "@/features/compliance/queries";
import { hasPermission } from "@/lib/factory-roles";
import { requireOrgDb } from "@/server/context";
import { listOrgMembers } from "@/server/members";

export default async function CumplimientoPage() {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "compliance.manage")) redirect("/panel");
  const [obligations, members] = await Promise.all([
    listComplianceObligations(db),
    listOrgMembers(ctx.organizationId),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Cumplimiento" description="Obligaciones, vencimientos y evidencia de resolución." />
      <form action={saveComplianceObligationAction} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <input name="code" required placeholder="Código" className="rounded-md border px-3 py-2" />
        <input name="title" required placeholder="Título" className="rounded-md border px-3 py-2" />
        <input name="dueDate" type="date" required className="rounded-md border px-3 py-2" />
        <select name="assignedUserId" className="rounded-md border px-3 py-2">
          <option value="">Sin responsable</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </select>
        <input name="description" placeholder="Descripción" className="rounded-md border px-3 py-2 sm:col-span-2" />
        <button className="rounded-md bg-primary px-3 py-2 text-primary-foreground sm:col-span-2">Crear obligación</button>
      </form>
      <div className="space-y-3">
        {obligations.map((item) => (
          <article key={item.id} className="rounded-xl border bg-card p-4">
            <p className="font-medium">{item.code} · {item.title}</p>
            <p className="text-xs text-muted-foreground">Vence {item.dueDate.toLocaleDateString("es-CL")} · {item.status}</p>
            <form action={saveComplianceObligationAction} className="mt-3 grid gap-2 sm:grid-cols-4">
              <input type="hidden" name="id" value={item.id} />
              <input name="code" defaultValue={item.code} required className="rounded-md border px-2 py-1" />
              <input name="title" defaultValue={item.title} required className="rounded-md border px-2 py-1" />
              <input name="dueDate" type="date" defaultValue={item.dueDate.toISOString().slice(0, 10)} required className="rounded-md border px-2 py-1" />
              <input name="description" defaultValue={item.description ?? ""} className="rounded-md border px-2 py-1" />
              <select
                name="assignedUserId"
                defaultValue={item.assignedUserId ?? ""}
                className="rounded-md border px-2 py-1"
              >
                <option value="">Sin responsable</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
              <button className="rounded-md border px-3 py-1 sm:col-span-4">Guardar cambios</button>
            </form>
            {item.status === "PENDING" ? (
              <form action={resolveComplianceObligationAction} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={item.id} />
                <select name="status" className="rounded-md border px-2 py-1"><option value="DONE">Completar</option><option value="WAIVED">Eximir</option></select>
                <input name="reason" required minLength={10} placeholder="Motivo o evidencia" className="min-w-64 flex-1 rounded-md border px-2 py-1" />
                <button className="rounded-md border px-3 py-1">Resolver</button>
              </form>
            ) : null}
            <form action={deleteComplianceObligationAction} className="mt-2">
              <input type="hidden" name="id" value={item.id} />
              <button className="text-sm text-destructive underline">Eliminar</button>
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}
