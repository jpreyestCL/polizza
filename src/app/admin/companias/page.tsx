import { PageHeader } from "@/components/page-header";
import { listGlobalCompanies } from "@/features/saas-admin/queries";
import { GlobalCompaniesPanel } from "@/features/saas-admin/components/global-companies-panel";

export default async function AdminCompaniasPage() {
  const rows = await listGlobalCompanies();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Compañías aseguradoras (catálogo global)"
        description="Estas compañías están disponibles para todos los tenants. Los corredores no pueden editar estos datos, solo agregar sus propios datos operativos (código corredor, link de cobranza, contactos)."
      />
      <GlobalCompaniesPanel rows={rows} />
    </div>
  );
}
