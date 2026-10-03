import { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/server/context";
import { basePrisma } from "@/server/db";
import { hasPermission } from "@/lib/factory-roles";
import {
  AUDIT_ACTION_LABELS,
  auditActionLabel,
} from "@/lib/audit-catalog";

const PAGE_SIZE = 25;

function value(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  return typeof params[key] === "string" ? params[key] : "";
}

function validDate(value: string, endOfDay = false): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireSession();
  if (!hasPermission(ctx.role, "audit.read")) notFound();
  const sp = await searchParams;
  const action = value(sp, "accion");
  const userId = value(sp, "usuario");
  const from = value(sp, "desde");
  const to = value(sp, "hasta");
  const requestedPage = Number.parseInt(value(sp, "pagina"), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const where: Prisma.AuditLogWhereInput = {
    organizationId: ctx.organizationId,
    ...(action ? { action } : {}),
    ...(userId ? { userId } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(validDate(from) ? { gte: validDate(from) } : {}),
            ...(validDate(to, true) ? { lte: validDate(to, true) } : {}),
          },
        }
      : {}),
  };
  const [total, logs, actors] = await Promise.all([
    basePrisma.auditLog.count({ where }),
    basePrisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    basePrisma.user.findMany({
      where: {
        members: { some: { organizationId: ctx.organizationId } },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (next: number) => {
    const params = new URLSearchParams();
    if (action) params.set("accion", action);
    if (userId) params.set("usuario", userId);
    if (from) params.set("desde", from);
    if (to) params.set("hasta", to);
    params.set("pagina", String(next));
    return `/configuracion/auditoria?${params}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoría"
        description="Eventos de seguridad y cambios administrativos de esta corredora."
      />
      <form className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-5">
        <Filter label="Acción">
          <select name="accion" defaultValue={action} className="rounded-md border bg-background px-2 py-2">
            <option value="">Todas</option>
            {Object.entries(AUDIT_ACTION_LABELS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </Filter>
        <Filter label="Usuario">
          <select name="usuario" defaultValue={userId} className="rounded-md border bg-background px-2 py-2">
            <option value="">Todos</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>{actor.name} · {actor.email}</option>
            ))}
          </select>
        </Filter>
        <Filter label="Desde">
          <input name="desde" type="date" defaultValue={from} className="rounded-md border bg-background px-2 py-2" />
        </Filter>
        <Filter label="Hasta">
          <input name="hasta" type="date" defaultValue={to} className="rounded-md border bg-background px-2 py-2" />
        </Filter>
        <div className="flex items-end gap-2">
          <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Filtrar</button>
          <Link href="/configuracion/auditoria" className="rounded-md border px-3 py-2 text-sm">Limpiar</Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Acción</th>
              <th className="p-3">Usuario</th>
              <th className="p-3">Origen</th>
              <th className="p-3">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log) => {
              const actor = log.userId ? actorById.get(log.userId) : null;
              return (
                <tr key={log.id} className="align-top">
                  <td className="whitespace-nowrap p-3">{log.createdAt.toLocaleString("es-CL")}</td>
                  <td className="p-3 font-medium">{auditActionLabel(log.action)}</td>
                  <td className="p-3">{actor ? `${actor.name} · ${actor.email}` : "Sistema"}</td>
                  <td className="p-3">
                    <span className="block">{log.ipAddress ?? "—"}</span>
                    <span className="block max-w-64 truncate text-xs text-muted-foreground" title={log.userAgent ?? undefined}>
                      {log.userAgent ?? "—"}
                    </span>
                  </td>
                  <td className="max-w-md p-3">
                    {log.metadata ? (
                      <pre className="whitespace-pre-wrap break-words text-xs">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No hay eventos para estos filtros.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span>{total} eventos · página {Math.min(page, pages)} de {pages}</span>
        <div className="flex gap-2">
          {page > 1 ? <Link href={pageHref(page - 1)} className="rounded-md border px-3 py-1.5">Anterior</Link> : null}
          {page < pages ? <Link href={pageHref(page + 1)} className="rounded-md border px-3 py-1.5">Siguiente</Link> : null}
        </div>
      </div>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
