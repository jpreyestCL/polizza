import Link from "next/link";
import { Plus, Shield } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listPolicies } from "@/features/policies/queries";
import { getCompanies } from "@/features/catalog/queries";
import { PoliciesTable } from "@/features/policies/components/policies-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/pager";
import { parsePageParams } from "@/lib/pagination";

type SearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

export default async function PolizasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = parsePageParams(sp);
  const { ctx, db } = await requireOrgDb();
  const [policiesPage, companies] = await Promise.all([
    listPolicies(ctx, db, page),
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
      {policiesPage.rows.length === 0 && !policiesPage.prevCursor ? (
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
        <>
          <PoliciesTable policies={policiesPage.rows} companies={companies} />
          <Pager
            page={policiesPage}
            baseHref="/polizas"
            searchParams={sp}
            itemLabel="pólizas"
          />
        </>
      )}
    </div>
  );
}
