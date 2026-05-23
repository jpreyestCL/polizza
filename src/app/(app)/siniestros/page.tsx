import Link from "next/link";
import { Plus, TriangleAlert } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listClaims } from "@/features/claims/queries";
import { ClaimsTable } from "@/features/claims/components/claims-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default async function SiniestrosPage() {
  const { ctx, db } = await requireOrgDb();
  const claims = await listClaims(ctx, db);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Siniestros"
        description="Seguimiento de siniestros desde el denuncio hasta la liquidación."
        actions={
          <Button asChild>
            <Link href="/siniestros/nuevo">
              <Plus />
              Nuevo siniestro
            </Link>
          </Button>
        }
      />
      {claims.length === 0 ? (
        <EmptyState
          icon={TriangleAlert}
          title="Aún no hay siniestros"
          description="Registra un siniestro para hacerle seguimiento con la compañía."
          action={
            <Button asChild>
              <Link href="/siniestros/nuevo">
                <Plus />
                Nuevo siniestro
              </Link>
            </Button>
          }
        />
      ) : (
        <ClaimsTable claims={claims} />
      )}
    </div>
  );
}
