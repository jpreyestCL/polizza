import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSuperadmin } from "@/server/context";
import { getGlobalProduct } from "@/features/saas-admin/queries";
import { ProductCoveragesPanel } from "@/features/saas-admin/components/product-coverages-panel";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

export default async function AdminProductoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperadmin();
  const { id } = await params;
  const product = await getGlobalProduct(id);
  if (!product) notFound();
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/productos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Productos
        </Link>
      </div>
      <PageHeader
        title={product.name}
        description={`${product.globalCompany.name} · ${product.branchType.name}`}
        actions={
          product.active ? (
            <Badge variant="success">Activo</Badge>
          ) : (
            <Badge variant="muted">Inactivo</Badge>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Info label="% Comisión afecta">
          {product.commissionAffectPct
            ? `${Number(product.commissionAffectPct)}%`
            : "—"}
        </Info>
        <Info label="% Comisión exenta">
          {product.commissionExemptPct
            ? `${Number(product.commissionExemptPct)}%`
            : "—"}
        </Info>
        <Info label="Código">
          {product.code ? <span className="font-mono">{product.code}</span> : "—"}
        </Info>
      </div>
      <ProductCoveragesPanel
        productId={product.id}
        coverages={product.coverages.map((c) => ({
          id: c.id,
          order: c.order,
          name: c.name,
          polCad: c.polCad,
          text: c.text,
          insuredAmount: c.insuredAmount ? Number(c.insuredAmount) : null,
          type: c.type,
          isCommercialValue: c.isCommercialValue,
          affectedByIva: c.affectedByIva,
          sumsToTotal: c.sumsToTotal,
        }))}
      />
    </div>
  );
}

function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium tabular-nums">{children}</div>
    </div>
  );
}
