import { getProposalSettings } from "@/features/organizations/proposal-settings";
import { ProposalSettingsForm } from "@/features/organizations/components/proposal-settings-form";
import { PageHeader } from "@/components/page-header";

export default async function ConfiguracionPropuestasPage() {
  const settings = await getProposalSettings();
  if (!settings) {
    return <div className="p-6 text-sm">No se pudo cargar la configuración.</div>;
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Propuestas"
        description="Configuración de numeración y plazos para el módulo de propuestas."
      />
      <ProposalSettingsForm initial={settings} />
    </div>
  );
}
