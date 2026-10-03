import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import {
  listClients,
  getOrgMembers,
  listClientFilterOptions,
} from "@/features/clients/queries";
import { ClientsTable } from "@/features/clients/components/clients-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/pager";
import { parsePageParams } from "@/lib/pagination";
import { hasPermission } from "@/lib/factory-roles";
import { maskEmail, maskPhone } from "@/features/clients/privacy";

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
    assignedUserId:
      typeof sp?.ejecutivo === "string" && sp.ejecutivo
        ? sp.ejecutivo
        : undefined,
    branchTypeId:
      typeof sp?.ramo === "string" && sp.ramo ? sp.ramo : undefined,
    tagId: typeof sp?.tag === "string" && sp.tag ? sp.tag : undefined,
  };
  const hasFilters = Boolean(
    filters.q ||
      filters.type ||
      filters.status ||
      filters.assignedUserId ||
      filters.branchTypeId ||
      filters.tagId,
  );
  const { ctx, db } = await requireOrgDb();
  const [clientsPage, members, filterOptions] = await Promise.all([
    listClients(ctx, db, page, filters),
    getOrgMembers(ctx.organizationId),
    listClientFilterOptions(db),
  ]);
  const canReadSensitive = hasPermission(ctx.role, "parties.read_sensitive");
  const visibleClients = canReadSensitive
    ? clientsPage.rows
    : clientsPage.rows.map((client) => ({
        ...client,
        email: maskEmail(client.email),
        phone: maskPhone(client.phone),
      }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Cartera de clientes de la corredora."
        actions={
          hasPermission(ctx.role, "parties.write") ? (
            <Button asChild>
              <Link href="/clientes/nuevo">
                <Plus />
                Nuevo cliente
              </Link>
            </Button>
          ) : null
        }
      />
      {clientsPage.rows.length === 0 && !clientsPage.prevCursor && !hasFilters ? (
        <EmptyState
          icon={Users}
          title="Aún no tienes clientes"
          description="Crea tu primer cliente para empezar a construir la cartera de la corredora."
          action={
            hasPermission(ctx.role, "parties.write") ? (
              <Button asChild>
                <Link href="/clientes/nuevo">
                  <Plus />
                  Nuevo cliente
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ClientsTable
            clients={visibleClients}
            members={members}
            tags={filterOptions.tags}
            branchTypes={filterOptions.branchTypes}
            canExport={hasPermission(ctx.role, "parties.export")}
          />
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
