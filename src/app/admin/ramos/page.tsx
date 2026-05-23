import { PageHeader } from "@/components/page-header";
import { listBranchTypes } from "@/features/saas-admin/queries";
import { BranchTypesPanel } from "@/features/saas-admin/components/branch-types-panel";

export default async function AdminRamosPage() {
  const rows = await listBranchTypes();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Ramos"
        description="Cada ramo define la ficha de datos que se le pide al corredor al crear un ítem de propuesta. Los campos se renderizan dinámicamente en el formulario."
      />
      <BranchTypesPanel rows={rows} />
    </div>
  );
}
