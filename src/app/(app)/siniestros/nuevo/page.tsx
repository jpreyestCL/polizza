import { PageHeader } from "@/components/page-header";
import { NewClaimWizard } from "@/features/claims/components/new-claim-wizard";

export default function NuevoSiniestroPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo siniestro"
        description="Busca la póliza siniestrada, selecciona el ítem afectado y registra el denuncio."
      />
      <NewClaimWizard />
    </div>
  );
}
