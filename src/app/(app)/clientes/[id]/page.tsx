import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import {
  getClientActivity,
  getClientDetail,
  getOrgMembers,
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
import { formatRut } from "@/lib/rut";
import { ClientAlertBanner } from "@/components/alert-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
  ] = await Promise.all([
    getClientActivity(db, id),
    getOrgMembers(ctx.organizationId),
    listDocuments(db, "CLIENT", id),
    listClientBranches(db, id),
    listClientProposals(db, id),
    listClientPolicies(db, id),
    listClientClaims(db, id),
    listClientCarQuotations(db, id),
  ]);
  const assignedUserName = client.assignedUserId
    ? (members.find((m) => m.userId === client.assignedUserId)?.name ?? null)
    : null;

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
          <Button asChild variant="outline">
            <Link href={`/clientes/${id}/editar`}>
              <Pencil />
              Editar
            </Link>
          </Button>
          {canDeleteClient(ctx.role) && (
            <DeleteClientDialog clientId={id} clientName={client.name} />
          )}
        </div>
      </div>

      {client.comentarioAlerta?.trim() && (
        <ClientAlertBanner message={client.comentarioAlerta} />
      )}

      <ClientTabs
        client={client}
        activity={activity}
        documents={documents}
        branches={branches}
        clientProposals={clientProposals}
        clientPolicies={clientPolicies}
        clientClaims={clientClaims}
        clientCarQuotations={clientCarQuotations}
        assignedUserName={assignedUserName}
      />
    </div>
  );
}
