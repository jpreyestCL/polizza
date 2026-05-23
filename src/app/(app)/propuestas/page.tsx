import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listProposals } from "@/features/proposals/queries";
import {
  getCompanies,
  getHolidaySet,
  getReturnReasons,
} from "@/features/catalog/queries";
import { ProposalsView } from "@/features/proposals/components/proposals-view";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default async function PropuestasPage() {
  const { ctx, db } = await requireOrgDb();
  const holidays = await getHolidaySet();
  const [proposals, companies, returnReasons] = await Promise.all([
    listProposals(ctx, db, holidays),
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
      {proposals.length === 0 ? (
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
      ) : (
        <ProposalsView
          proposals={proposals}
          companies={companies}
          returnReasons={returnReasons}
        />
      )}
    </div>
  );
}
