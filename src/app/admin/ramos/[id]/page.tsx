import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSuperadmin } from "@/server/context";
import { BranchFieldsPanel } from "@/features/saas-admin/components/branch-fields-panel";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

export default async function AdminRamoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { prisma } = await requireSuperadmin();
  const { id } = await params;
  const branch = await prisma.branchType.findUnique({
    where: { id },
    include: {
      fieldSchemas: { orderBy: { order: "asc" } },
    },
  });
  if (!branch) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/ramos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Ramos
      </Link>
      <PageHeader
        title={branch.name}
        description={`Clave: ${branch.key}`}
        actions={
          <div className="flex gap-2">
            <Badge variant="secondary">
              {branch.category === "GENERALES" ? "Generales" : "Vida y Salud"}
            </Badge>
            {branch.active ? (
              <Badge variant="success">Activo</Badge>
            ) : (
              <Badge variant="muted">Inactivo</Badge>
            )}
          </div>
        }
      />
      <BranchFieldsPanel
        branchTypeId={branch.id}
        fields={branch.fieldSchemas.map((f) => ({
          id: f.id,
          fieldKey: f.fieldKey,
          label: f.label,
          type: f.type,
          required: f.required,
          order: f.order,
          options: f.options as { value: string; label: string }[] | null,
          helpText: f.helpText,
        }))}
      />
    </div>
  );
}
