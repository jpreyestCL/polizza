import { redirect } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import { canManageCommissions } from "@/lib/roles";
import {
  listSettlements,
  listSettleablePolicies,
} from "@/features/commissions/queries";
import { getCompanies, getLines } from "@/features/catalog/queries";
import { getOrgMembers } from "@/features/clients/queries";
import { CommissionsNav } from "@/features/commissions/components/commissions-nav";
import { GenerateSettlement } from "@/features/commissions/components/generate-settlement";
import { SettlementsList } from "@/features/commissions/components/settlements-list";
import { PageHeader } from "@/components/page-header";

type SearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

export default async function LiquidacionesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { ctx, db } = await requireOrgDb();
  if (!canManageCommissions(ctx.role)) redirect("/panel");

  const sp = await searchParams;
  const vendedor =
    typeof sp?.vendedor === "string" && sp.vendedor.length > 0
      ? sp.vendedor
      : null;

  const [settlements, companies, lines, members, settleable] =
    await Promise.all([
      listSettlements(db),
      getCompanies(db),
      getLines(db),
      getOrgMembers(ctx.organizationId),
      vendedor
        ? listSettleablePolicies(ctx, db, vendedor)
        : Promise.resolve({ rows: [], defaultPct: null }),
    ]);

  const memberOpts = members.map((m) => ({ userId: m.userId, name: m.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comisiones"
        description="Comisiones de la corredora por póliza y liquidación a vendedores."
      />
      <CommissionsNav />
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Generar liquidación
        </h2>
        <GenerateSettlement
          salespersonId={vendedor}
          members={memberOpts}
          rows={settleable.rows}
          defaultPct={settleable.defaultPct}
          companies={companies}
          lines={lines}
        />
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Liquidaciones
        </h2>
        <SettlementsList rows={settlements} members={memberOpts} />
      </section>
    </div>
  );
}
