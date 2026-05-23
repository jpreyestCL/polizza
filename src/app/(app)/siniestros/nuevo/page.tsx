import Link from "next/link";
import { Users } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listClients, getOrgMembers } from "@/features/clients/queries";
import { listPolicies } from "@/features/policies/queries";
import { ClaimForm } from "@/features/claims/components/claim-form";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { ClaimFormValues } from "@/features/claims/schemas";

export default async function NuevoSiniestroPage() {
  const { ctx, db } = await requireOrgDb();
  const [clients, policies, members] = await Promise.all([
    listClients(ctx, db),
    listPolicies(ctx, db),
    getOrgMembers(ctx.organizationId),
  ]);

  const defaultValues: ClaimFormValues = {
    clientId: "",
    policyId: "",
    description: "",
    occurredAt: "",
    reportedAt: "",
    estimatedAmount: "",
    settledAmount: "",
    currency: "UF",
    assignedUserId: ctx.userId,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo siniestro"
        description="Registra un siniestro y hazle seguimiento."
      />
      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Necesitas un cliente primero"
          description="Un siniestro siempre se asocia a un cliente. Crea un cliente antes de continuar."
          action={
            <Button asChild>
              <Link href="/clientes/nuevo">Crear cliente</Link>
            </Button>
          }
        />
      ) : (
        <ClaimForm
          mode="create"
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          policies={policies.map((p) => ({
            id: p.id,
            name: p.policyNumber,
          }))}
          members={members}
          defaultValues={defaultValues}
        />
      )}
    </div>
  );
}
