import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireOrgDb } from "@/server/context";
import { hasPermission } from "@/lib/factory-roles";
import { TENANT_FEATURE_CODES } from "@/lib/domain/tenant-features";
import { ensureOrganizationConfiguration } from "@/server/tenant-features";
import { updateOrganizationSettingsAction } from "@/features/organizations/settings-actions";

const FEATURE_LABELS: Record<(typeof TENANT_FEATURE_CODES)[number], string> = {
  AI_EXTRACTION: "Extracción con IA",
  QUOTE_COMPARATOR: "Comparador de cotizaciones",
  INBOUND_EMAIL: "Correo entrante",
  COLLECTIONS_AUTO_EMAIL: "Correos automáticos de cobranza",
  AI_ASSISTANT: "Asistente con IA",
  COMMISSION_AGENTS: "Comisiones de vendedores",
  CLIENT_PORTAL: "Portal de clientes",
  CASH_RECEIPTS: "Recibos de caja",
  WHATSAPP_API: "Integración WhatsApp",
};

export default async function ParametrosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "settings.manage")) notFound();
  const sp = await searchParams;
  const settings = await ensureOrganizationConfiguration(db, ctx.organizationId);
  const features: { code: string; enabled: boolean }[] =
    await db.tenantFeature.findMany({ orderBy: { code: "asc" } });
  const enabled = new Map(features.map((feature) => [feature.code, feature.enabled]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parámetros"
        description="Seguridad, comportamiento financiero y módulos habilitados para la corredora."
      />
      {sp.aviso === "guardado" ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          Parámetros guardados.
        </p>
      ) : null}
      <form action={updateOrganizationSettingsAction} className="space-y-6">
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Configuración general</h2>
          <Toggle
            name="presumedPaidEnabled"
            label="Presunción de pago PAC/PAT"
            description="Considera pagadas las cuotas asociadas a medios automáticos según las reglas de cobranza."
            checked={settings.presumedPaidEnabled}
          />
          <Toggle
            name="mfaRequired"
            label="Exigir segundo factor"
            description="Los miembros deberán activar y validar TOTP para acceder."
            checked={settings.mfaRequired}
          />
          <Toggle
            name="ssoEnabled"
            label="SSO habilitado"
            description="Habilita el inicio de sesión corporativo cuando exista un proveedor configurado."
            checked={settings.ssoEnabled}
          />
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div>
            <h2 className="font-semibold">Módulos</h2>
            <p className="text-sm text-muted-foreground">
              Activa únicamente las capacidades contratadas por esta corredora.
            </p>
          </div>
          {TENANT_FEATURE_CODES.map((code) => (
            <Toggle
              key={code}
              name={`feature:${code}`}
              label={FEATURE_LABELS[code]}
              checked={enabled.get(code) ?? false}
            />
          ))}
        </section>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Guardar parámetros
        </button>
      </form>
    </div>
  );
}

function Toggle({
  name,
  label,
  description,
  checked,
}: {
  name: string;
  label: string;
  description?: string;
  checked: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 text-sm">
      <span>
        <span className="block font-medium">{label}</span>
        {description ? (
          <span className="text-muted-foreground">{description}</span>
        ) : null}
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="mt-1 size-4"
      />
    </label>
  );
}
