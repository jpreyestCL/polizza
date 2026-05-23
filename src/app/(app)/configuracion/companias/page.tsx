import { requireOrgDb } from "@/server/context";
import {
  listTenantCompanies,
  listAvailableGlobalCompanies,
} from "@/features/tenant-config/queries";
import { TenantCompaniesPanel } from "@/features/tenant-config/components/tenant-companies-panel";
import { PageHeader } from "@/components/page-header";

export default async function ConfiguracionCompaniasPage() {
  const { ctx, db } = await requireOrgDb();
  const [companies, available] = await Promise.all([
    listTenantCompanies(db),
    listAvailableGlobalCompanies(ctx.organizationId),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Compañías aseguradoras"
        description="Adopta compañías del catálogo global o crea las tuyas. Los datos predefinidos (razón social, RUT, dirección) vienen del catálogo, tú ingresas los datos operativos del corredor (código, link de cobranza, transferencias, contactos)."
      />
      <TenantCompaniesPanel rows={companies} available={available} />
    </div>
  );
}
