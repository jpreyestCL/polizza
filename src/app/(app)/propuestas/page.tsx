import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import {
  listAllProposalsForKanban,
  listProposals,
} from "@/features/proposals/queries";
import {
  getCompanies,
  getHolidaySet,
  getReturnReasons,
} from "@/features/catalog/queries";
import { ProposalsKanban } from "@/features/proposals/components/proposals-kanban";
import { ProposalsTable } from "@/features/proposals/components/proposals-table";
import { ProposalsViewSwitch } from "@/features/proposals/components/view-switch";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/pager";
import { parsePageParams } from "@/lib/pagination";

type SearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

export default async function PropuestasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const view = sp?.view === "lista" ? "lista" : "kanban";
  const { ctx, db } = await requireOrgDb();
  const holidays = await getHolidaySet();

  const [companies, returnReasons] = await Promise.all([
    getCompanies(db),
    getReturnReasons(db),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Propuestas"
        description="Flujo operativo de propuestas, desde la elaboración hasta el despacho."
        actions={
          <Button asChild>
            <Link href="/propuestas/nuevo">
              <Plus />
              Nueva propuesta
            </Link>
          </Button>
        }
      />
      <ProposalsViewSwitch view={view} searchParams={sp} />

      {view === "kanban" ? (
        <KanbanView
          ctx={ctx}
          db={db}
          holidays={holidays}
          companies={companies}
          returnReasons={returnReasons}
        />
      ) : (
        <ListView
          ctx={ctx}
          db={db}
          holidays={holidays}
          companies={companies}
          searchParams={sp}
        />
      )}
    </div>
  );
}

async function KanbanView({
  ctx,
  db,
  holidays,
  companies,
  returnReasons,
}: {
  ctx: Awaited<ReturnType<typeof requireOrgDb>>["ctx"];
  db: Awaited<ReturnType<typeof requireOrgDb>>["db"];
  holidays: Set<string>;
  companies: Awaited<ReturnType<typeof getCompanies>>;
  returnReasons: Awaited<ReturnType<typeof getReturnReasons>>;
}) {
  const proposals = await listAllProposalsForKanban(ctx, db, holidays);
  if (proposals.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Aún no hay propuestas"
        description="Crea tu primera propuesta para gestionarla en el Kanban."
        action={
          <Button asChild>
            <Link href="/propuestas/nuevo">
              <Plus />
              Nueva propuesta
            </Link>
          </Button>
        }
      />
    );
  }
  return (
    <ProposalsKanban
      proposals={proposals}
      companies={companies}
      returnReasons={returnReasons}
    />
  );
}

async function ListView({
  ctx,
  db,
  holidays,
  companies,
  searchParams,
}: {
  ctx: Awaited<ReturnType<typeof requireOrgDb>>["ctx"];
  db: Awaited<ReturnType<typeof requireOrgDb>>["db"];
  holidays: Set<string>;
  companies: Awaited<ReturnType<typeof getCompanies>>;
  searchParams: Record<string, string | string[] | undefined> | undefined;
}) {
  const page = parsePageParams(searchParams);
  const proposalsPage = await listProposals(ctx, db, holidays, page);
  if (proposalsPage.rows.length === 0 && !proposalsPage.prevCursor) {
    return (
      <EmptyState
        icon={FileText}
        title="Aún no hay propuestas"
        description="Crea tu primera propuesta para gestionarla en el Kanban."
        action={
          <Button asChild>
            <Link href="/propuestas/nuevo">
              <Plus />
              Nueva propuesta
            </Link>
          </Button>
        }
      />
    );
  }
  return (
    <>
      <ProposalsTable proposals={proposalsPage.rows} companies={companies} />
      <Pager
        page={proposalsPage}
        baseHref="/propuestas"
        searchParams={searchParams}
        itemLabel="propuestas"
      />
    </>
  );
}
