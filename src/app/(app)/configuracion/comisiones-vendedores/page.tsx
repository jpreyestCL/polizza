import { redirect } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import { canEditCommissionRates } from "@/lib/roles";
import { listSalespersonRates } from "@/features/commissions/queries";
import { getOrgMembers } from "@/features/clients/queries";
import { RatesPanel } from "@/features/commissions/components/rates-panel";
import { PageHeader } from "@/components/page-header";

export default async function ComisionesVendedoresPage() {
  const { ctx, db } = await requireOrgDb();
  if (!canEditCommissionRates(ctx.role)) redirect("/panel");

  const [members, rates] = await Promise.all([
    getOrgMembers(ctx.organizationId),
    listSalespersonRates(db),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comisiones de vendedores"
        description="Tasa default de comisión por vendedor, como % de la comisión de la corredora. El porcentaje puede ajustarse por póliza para cerrar acuerdos."
      />
      <RatesPanel
        members={members.map((m) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
        }))}
        rates={rates}
      />
    </div>
  );
}
