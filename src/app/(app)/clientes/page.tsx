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
  const { ctx, db } = await requireOrgDb();
  const [clientsPage, members] = await Promise.all([
    listClients(ctx, db, page),
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
      {clientsPage.rows.length === 0 && !clientsPage.prevCursor ? (
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
