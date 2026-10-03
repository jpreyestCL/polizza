import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { hasPermission } from "@/lib/factory-roles";
import { requireOrgDb } from "@/server/context";
import {
  createPrivacyRequestAction,
  transitionPrivacyRequestAction,
} from "@/features/privacy/actions";
import {
  listPrivacyClients,
  listPrivacyRequests,
} from "@/features/privacy/queries";
import { REQUEST_STATUSES, REQUEST_TYPES } from "@/features/privacy/schemas";

export default async function PrivacidadPage() {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "privacy.manage")) redirect("/panel");
  const [requests, clients] = await Promise.all([
    listPrivacyRequests(db),
    listPrivacyClients(db),
  ]);
  const due = new Date(Date.now() + 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Privacidad"
        description="Solicitudes de derechos de titulares y trazabilidad de su atención."
      />
      <form action={createPrivacyRequestAction} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <select name="clientId" required className="rounded-md border bg-background px-3 py-2">
          <option value="">Cliente…</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name} · {client.rut}</option>
          ))}
        </select>
        <select name="type" className="rounded-md border bg-background px-3 py-2">
          {REQUEST_TYPES.map((type) => <option key={type}>{type}</option>)}
        </select>
        <input name="channel" placeholder="Canal de recepción" className="rounded-md border px-3 py-2" />
        <input name="dueAt" type="date" defaultValue={due} required className="rounded-md border px-3 py-2" />
        <input name="requestNote" placeholder="Detalle de la solicitud" className="rounded-md border px-3 py-2 sm:col-span-2" />
        <button className="rounded-md bg-primary px-3 py-2 text-primary-foreground sm:col-span-2">Crear solicitud</button>
      </form>
      <div className="space-y-3">
        {requests.map((request) => (
          <article key={request.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-medium">{request.client.name} · {request.type}</p>
                <p className="text-xs text-muted-foreground">{request.client.rut} · vence {request.dueAt.toLocaleDateString("es-CL")} · {request.status}</p>
              </div>
              <a className="text-sm text-primary underline" href={`/api/privacidad/${request.id}/export`}>Exportar JSON</a>
            </div>
            <form action={transitionPrivacyRequestAction} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="id" value={request.id} />
              <select name="status" defaultValue={request.status} className="rounded-md border bg-background px-2 py-1">
                {REQUEST_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
              <input name="reason" minLength={10} placeholder="Motivo (obligatorio al cerrar/rechazar)" className="min-w-64 flex-1 rounded-md border px-2 py-1" />
              <button className="rounded-md border px-3 py-1">Actualizar</button>
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}
