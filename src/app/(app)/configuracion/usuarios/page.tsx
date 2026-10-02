import { notFound } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import { listOrgInvitations, listOrgMembers } from "@/server/members";
import {
  cancelInvitationAction,
  changeMemberRoleAction,
  inviteMemberAction,
  removeMemberAction,
} from "@/features/members/actions";
import {
  FACTORY_ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  factoryRoleOf,
  hasPermission,
} from "@/lib/factory-roles";
import { roleLabel } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/lib/utils";

const NOTICES: Record<string, string> = {
  permiso: "No tienes permiso para administrar usuarios.",
  rol: "Elige uno de los seis roles.",
  "rol-ok": "Rol actualizado.",
  miembro: "Ese miembro no es de esta corredora.",
  "ultimo-admin": "La corredora tiene que quedar con al menos un administrador.",
  propio: "No puedes sacarte a ti mismo de la corredora.",
  quitado: "Miembro quitado de la corredora.",
  "invitacion-datos": "Indica un correo válido y un rol.",
  "invitacion-error": "No se pudo enviar la invitación.",
  invitado: "Invitación enviada.",
  "invitacion-cancelada": "Invitación cancelada.",
};

const ROLE_SUMMARY: Record<string, string> = {
  ADMIN: "Todo, incluidos usuarios, catálogos y acciones sensibles.",
  ACCOUNT_EXECUTIVE: "Clientes, cotizaciones, propuestas, pólizas, endosos, renovaciones y despacho.",
  COLLECTIONS: "Cobranza: cuotas, pagos, recordatorios, castigos y cancelación por no pago.",
  CLAIMS: "Siniestros de punta a punta, con documentos confidenciales.",
  FINANCE: "Comisiones: conciliación, diferencias y liquidaciones; informes.",
  READ_ONLY: "Solo lectura de clientes, pólizas, siniestros, cobranza e informes.",
};

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ctx } = await requireOrgDb();
  if (!hasPermission(ctx.role, "users.manage")) notFound();
  const sp = await searchParams;
  const notice = typeof sp.aviso === "string" ? NOTICES[sp.aviso] : null;
  const detail = typeof sp.detalle === "string" ? sp.detalle : null;
  const [members, invitations] = await Promise.all([
    listOrgMembers(ctx.organizationId),
    listOrgInvitations(ctx.organizationId),
  ]);
  const sensitive = new Set(
    PERMISSIONS.filter((permission) => permission.sensitive).map(
      (permission) => permission.code,
    ),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios y roles"
        description="Seis roles de fábrica. Cada usuario tiene uno; el rol decide qué puede ver y hacer en toda la corredora."
      />
      {notice ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          {notice}
          {detail ? ` ${detail}` : ""}
        </p>
      ) : null}

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Miembros ({members.length})</h2>
        <ul className="divide-y text-sm">
          {members.map((member) => {
            const current = factoryRoleOf(member.role);
            return (
              <li
                key={member.memberId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {member.name}
                    {member.userId === ctx.userId ? (
                      <span className="ml-2 text-xs text-muted-foreground">(tú)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {member.email} · desde {formatDate(member.createdAt)}
                    {current &&
                    current !== member.role &&
                    roleLabel(member.role) !== roleLabel(current)
                      ? ` · rol anterior "${roleLabel(member.role)}", hoy rige como ${roleLabel(current)}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={changeMemberRoleAction} className="flex items-center gap-2">
                    <input type="hidden" name="memberId" value={member.memberId} />
                    <select
                      name="role"
                      defaultValue={current ?? ""}
                      aria-label={`Rol de ${member.name}`}
                      className="rounded-md border bg-background px-2 py-1.5"
                    >
                      {FACTORY_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-md border px-3 py-1.5">
                      Guardar
                    </button>
                  </form>
                  {member.userId !== ctx.userId ? (
                    <form action={removeMemberAction}>
                      <input type="hidden" name="memberId" value={member.memberId} />
                      <button
                        type="submit"
                        className="rounded-md border px-3 py-1.5 text-destructive"
                      >
                        Quitar
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Invitar</h2>
        <form action={inviteMemberAction} className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Correo</span>
            <input
              name="email"
              type="email"
              required
              className="rounded-md border bg-background px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Rol</span>
            <select
              name="role"
              defaultValue="ACCOUNT_EXECUTIVE"
              className="rounded-md border bg-background px-2 py-1.5"
            >
              {FACTORY_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-md border px-3 py-1.5">
            Enviar invitación
          </button>
        </form>
        {invitations.length > 0 ? (
          <ul className="divide-y text-sm">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>
                  {invitation.email}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {invitation.role ? roleLabel(invitation.role) : "sin rol"} · vence{" "}
                    {formatDate(invitation.expiresAt)}
                  </span>
                </span>
                <form action={cancelInvitationAction}>
                  <input type="hidden" name="invitationId" value={invitation.id} />
                  <button type="submit" className="text-xs text-destructive hover:underline">
                    Cancelar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No hay invitaciones pendientes.</p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Qué puede hacer cada rol</h2>
        <ul className="divide-y text-sm">
          {FACTORY_ROLES.map((role) => (
            <li key={role} className="py-3">
              <p className="font-medium">{roleLabel(role)}</p>
              <p className="text-xs text-muted-foreground">{ROLE_SUMMARY[role]}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {ROLE_PERMISSIONS[role].length} permisos ·{" "}
                {ROLE_PERMISSIONS[role].filter((code) => sensitive.has(code)).length}{" "}
                sensibles
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
