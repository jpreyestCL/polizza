import { notFound } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import { listCredentials } from "@/features/insurer-credentials/queries";
import { CredentialsPanel } from "@/features/insurer-credentials/components/credentials-panel";
import { listInsurers } from "@/features/car-quotes/insurers/registry";
import { PageHeader } from "@/components/page-header";

export default async function ConfiguracionPortalesPage() {
  const { ctx, db } = await requireOrgDb();
  if (ctx.role !== "admin") notFound();
  const credentials = await listCredentials(db);
  const insurers = listInsurers();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Portales aseguradoras"
        description="Credenciales para que los adaptadores de cotización inicien sesión en cada portal. La contraseña se cifra en reposo."
      />
      <CredentialsPanel credentials={credentials} insurers={insurers} />
    </div>
  );
}
