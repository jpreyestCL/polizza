import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import {
  getClientActivity,
  getClientDetail,
  getOrgMembers,
  listClientFilterOptions,
} from "@/features/clients/queries";
import { ClientTabs } from "@/features/clients/components/client-tabs";
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge";
import { DeleteClientDialog } from "@/features/clients/components/delete-client-dialog";
import { listClientProposals } from "@/features/proposals/queries";
import { listClientPolicies } from "@/features/policies/queries";
import { listClientClaims } from "@/features/claims/queries";
import { listClientCarQuotations } from "@/features/car-quotes/queries";
import { listDocuments } from "@/features/documents/queries";
import { listClientBranches } from "@/features/branches/queries";
import { canDeleteClient } from "@/lib/roles";
import { mergeClientFormAction } from "@/features/clients/actions";
import { hasPermission } from "@/lib/factory-roles";
import { formatRut } from "@/lib/rut";
import { ClientAlertBanner } from "@/components/alert-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientTagsManager } from "@/features/clients/components/client-tags-manager";
import { maskAddress, maskEmail, maskPhone } from "@/features/clients/privacy";

export default async function ClienteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const aviso = typeof sp.aviso === "string" ? sp.aviso : null;
  const { ctx, db } = await requireOrgDb();

  const client = await getClientDetail(db, id);
  if (!client) notFound();

  const [
    activity,
    members,
    documents,
    branches,
    clientProposals,
    clientPolicies,
    clientClaims,
    clientCarQuotations,
    filterOptions,
  ] = await Promise.all([
    getClientActivity(db, id),
    getOrgMembers(ctx.organizationId),
    listDocuments(db, "CLIENT", id),
    listClientBranches(db, id),
    listClientProposals(db, id),
    listClientPolicies(db, id),
    listClientClaims(db, id),
    listClientCarQuotations(db, id),
    listClientFilterOptions(db),
  ]);
  const assignedUserName = client.assignedUserId
    ? (members.find((m) => m.userId === client.assignedUserId)?.name ?? null)
    : null;
  const canReadSensitive = hasPermission(ctx.role, "parties.read_sensitive");
  const clientForView = canReadSensitive
    ? client
    : {
        ...client,
        email: maskEmail(client.email),
        phone: maskPhone(client.phone),
        celular: maskPhone(client.celular),
        address: maskAddress(client.address),
        birthDate: null,
        contacts: client.contacts.map((contact) => ({
          ...contact,
          email: maskEmail(contact.email),
          phone: maskPhone(contact.phone),
          celular: maskPhone(contact.celular),
        })),
      };
  const branchesForView = canReadSensitive
    ? branches
    : branches.map((branch) => ({
        ...branch,
        email: maskEmail(branch.email),
        phone: maskPhone(branch.phone),
        celular: maskPhone(branch.celular),
        address: maskAddress(branch.address),
      }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {client.name}
            </h1>
            <ClientStatusBadge status={client.status} />
            <Badge variant="muted">
              {client.type === "EMPRESA" ? "Empresa" : "Persona"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            RUT {formatRut(client.rut)}
          </p>
        </div>
        <div className="flex gap-2">
          {hasPermission(ctx.role, "parties.write") && (
            <Button asChild variant="outline">
              <Link href={`/clientes/${id}/editar`}>
                <Pencil />
                Editar
              </Link>
            </Button>
          )}
          {canDeleteClient(ctx.role) && (
            <DeleteClientDialog clientId={id} clientName={client.name} />
          )}
        </div>
      </div>

      {aviso ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">{aviso}</p>
      ) : null}
      {hasPermission(ctx.role, "parties.merge") ? (
        <form action={mergeClientFormAction} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
          <input type="hidden" name="targetId" value={id} />
          <label className="flex flex-col gap-1 text-sm">
            Fusionar otro RUT en esta ficha
            <input name="sourceRut" required className="rounded-md border bg-background px-2 py-1.5" placeholder="RUT duplicado" />
          </label>
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
            Motivo
            <input name="reason" required minLength={10} className="rounded-md border bg-background px-2 py-1.5" />
          </label>
          <button type="submit" className="rounded-md border px-3 py-2 text-sm">Fusionar</button>
        </form>
      ) : null}

      {client.comentarioAlerta?.trim() && (
        <ClientAlertBanner message={client.comentarioAlerta} />
      )}

      <ClientTagsManager
        clientId={id}
        tags={filterOptions.tags}
        assignedTagIds={client.tagAssignments.map((assignment) => assignment.tagId)}
        canWrite={hasPermission(ctx.role, "parties.write")}
      />

      <ClientTabs
        client={clientForView}
        activity={activity}
        documents={documents}
        branches={branchesForView}
        clientProposals={clientProposals}
        clientPolicies={clientPolicies}
        clientClaims={clientClaims}
        clientCarQuotations={clientCarQuotations}
        assignedUserName={assignedUserName}
        sensitiveMasked={!canReadSensitive}
        hasBirthDate={Boolean(client.birthDate)}
      />
    </div>
  );
}
