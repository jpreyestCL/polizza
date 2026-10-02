import { redirect } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import { hasPermission } from "@/lib/factory-roles";
import { EMAIL_TEMPLATES } from "@/lib/email-templates";
import { PageHeader } from "@/components/page-header";

export default async function PlantillasPage() {
  const { ctx } = await requireOrgDb();
  if (!hasPermission(ctx.role, "templates.manage")) redirect("/panel");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plantillas de correo"
        description="Catálogo de eventos. El correo de propuesta y de póliza sigue usando el texto que se escribe al enviar. Estas fichas dicen a quién va cada aviso."
      />
      <ul className="divide-y rounded-xl border bg-card">
        {EMAIL_TEMPLATES.map((template) => (
          <li key={template.code} className="px-4 py-3 text-sm">
            <p className="font-medium">{template.event}</p>
            <p className="text-muted-foreground">
              {template.code} · {template.recipient}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
