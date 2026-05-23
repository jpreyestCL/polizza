import Link from "next/link";
import { Plus, Shield } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listPolicies } from "@/features/policies/queries";
import { getCompanies } from "@/features/catalog/queries";
import { PoliciesTable } from "@/features/policies/components/policies-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default async function PolizasPage() {
  const { ctx, db } = await requireOrgDb();
  const [policies, companies] = await Promise.all([
    listPolicies(ctx, db),
    getCompanies(db),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pólizas"
        description="Cartera de pólizas de la corredora."
        actions={
          <Button asChild>
            <Link href="/polizas/nuevo">
              <Plus />
              Nueva póliza
            </Link>
          </Button>
        }
      />
      {policies.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="Aún no hay pólizas"
          description="Registra una póliza o conviértela desde una propuesta emitida."
          action={
            <Button asChild>
              <Link href="/polizas/nuevo">
                <Plus />
                Nueva póliza
              </Link>
            </Button>
          }
        />
      ) : (
        <PoliciesTable policies={policies} companies={companies} />
      )}
    </div>
  );
}
