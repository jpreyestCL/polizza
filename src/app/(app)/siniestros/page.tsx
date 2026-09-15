import Link from "next/link";
import { Plus, TriangleAlert } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listClaims } from "@/features/claims/queries";
import { ClaimsTable } from "@/features/claims/components/claims-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/pager";
import { ListSearch } from "@/components/list-search";
import { parsePageParams } from "@/lib/pagination";

type SearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

export default async function SiniestrosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = parsePageParams(sp);
  const { ctx, db } = await requireOrgDb();
  const q = typeof sp?.q === "string" ? sp.q : undefined;
  const claimsPage = await listClaims(ctx, db, page, q);

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
      <ListSearch placeholder="Buscar por N° de siniestro, póliza o cliente…" />
      {claimsPage.rows.length === 0 && !claimsPage.prevCursor && !q ? (
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
        <>
          <ClaimsTable claims={claimsPage.rows} />
          <Pager
            page={claimsPage}
            baseHref="/siniestros"
            searchParams={sp}
            itemLabel="siniestros"
          />
        </>
      )}
    </div>
  );
}
