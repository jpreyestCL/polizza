import { requireOrgDb } from "@/server/context";
import { basePrisma } from "@/server/db";
import {
  listTenantProducts,
  listAvailableGlobalProducts,
  listTenantCompanies,
} from "@/features/tenant-config/queries";
import { TenantProductsPanel } from "@/features/tenant-config/components/tenant-products-panel";
import { PageHeader } from "@/components/page-header";

export default async function ConfiguracionProductosPage() {
  const { ctx, db } = await requireOrgDb();
  const [products, available, companies, branches] = await Promise.all([
    listTenantProducts(db),
    listAvailableGlobalProducts(ctx.organizationId),
    listTenantCompanies(db),
    basePrisma.branchType.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true, category: true },
    }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos"
        description="Adopta productos del catálogo global o crea los tuyos. Para cada producto puedes overridear el % de comisión que aplicas en tu corredora."
      />
      <TenantProductsPanel
        products={products}
        available={available}
        companies={companies.filter((c) => c.status === "ACTIVA")}
        branches={branches}
      />
    </div>
  );
}
