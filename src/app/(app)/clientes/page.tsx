import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listClients, getOrgMembers } from "@/features/clients/queries";
import { ClientsTable } from "@/features/clients/components/clients-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/pager";
import { parsePageParams } from "@/lib/pagination";

type SearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = parsePageParams(sp);
  const typeParam = typeof sp?.type === "string" ? sp.type : undefined;
  const statusParam = typeof sp?.status === "string" ? sp.status : undefined;
  const filters = {
    q: typeof sp?.q === "string" && sp.q.length > 0 ? sp.q : undefined,
    type:
      typeParam === "PERSONA" || typeParam === "EMPRESA"
        ? (typeParam as "PERSONA" | "EMPRESA")
        : undefined,
    status:
      statusParam === "PROSPECTO" ||
      statusParam === "ACTIVO" ||
      statusParam === "INACTIVO"
        ? (statusParam as "PROSPECTO" | "ACTIVO" | "INACTIVO")
        : undefined,
    sort: sp?.sort === "name" ? ("name" as const) : undefined,
    order:
      sp?.order === "desc" ? ("desc" as const)
      : sp?.order === "asc" ? ("asc" as const)
      : undefined,
  };
  const hasFilters = Boolean(filters.q || filters.type || filters.status);
  const { ctx, db } = await requireOrgDb();
  const [clientsPage, members] = await Promise.all([
    listClients(ctx, db, page, filters),
    getOrgMembers(ctx.organizationId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Cartera de clientes de la corredora."
        actions={
          <Button asChild>
            <Link href="/clientes/nuevo">
              <Plus />
              Nuevo cliente
            </Link>
          </Button>
        }
      />
      {clientsPage.rows.length === 0 && !clientsPage.prevCursor && !hasFilters ? (
        <EmptyState
          icon={Users}
          title="Aún no tienes clientes"
          description="Crea tu primer cliente para empezar a construir la cartera de la corredora."
          action={
            <Button asChild>
              <Link href="/clientes/nuevo">
                <Plus />
                Nuevo cliente
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <ClientsTable clients={clientsPage.rows} members={members} />
          <Pager
            page={clientsPage}
            baseHref="/clientes"
            searchParams={sp}
            itemLabel="clientes"
          />
        </>
      )}
    </div>
  );
}
