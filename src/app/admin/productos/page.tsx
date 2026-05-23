import { PageHeader } from "@/components/page-header";
import {
  listGlobalCompanies,
  listGlobalProducts,
  listBranchTypes,
} from "@/features/saas-admin/queries";
import { GlobalProductsPanel } from "@/features/saas-admin/components/global-products-panel";

export default async function AdminProductosPage() {
  const [products, companies, branches] = await Promise.all([
    listGlobalProducts(),
    listGlobalCompanies(),
    listBranchTypes(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos (catálogo global)"
        description="Productos preconfigurados por compañía y ramo. Los corredores pueden adoptarlos en su tenant y sobreescribir solo el % de comisión y agregar coberturas extra."
      />
      <GlobalProductsPanel
        rows={products}
        companies={companies.filter((c) => c.active)}
        branches={branches.filter((b) => b.active)}
      />
    </div>
  );
}
