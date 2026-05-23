import Link from "next/link";
import { Car, Plus } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listCarQuotations } from "@/features/car-quotes/queries";
import { QuotationsTable } from "@/features/car-quotes/components/quotations-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default async function CotizacionesPage() {
  const { ctx, db } = await requireOrgDb();
  const quotations = await listCarQuotations(ctx, db);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cotizaciones de auto"
        description="Cotiza en múltiples aseguradoras y compara resultados en una tabla."
        actions={
          <Button asChild>
            <Link href="/cotizaciones/nueva">
              <Plus />
              Nueva cotización
            </Link>
          </Button>
        }
      />
      {quotations.length === 0 ? (
        <EmptyState
          icon={Car}
          title="Aún no hay cotizaciones"
          description="Inicia una cotización desde la ficha de un cliente o aquí."
          action={
            <Button asChild>
              <Link href="/cotizaciones/nueva">
                <Plus />
                Nueva cotización
              </Link>
            </Button>
          }
        />
      ) : (
        <QuotationsTable quotations={quotations} />
      )}
    </div>
  );
}
