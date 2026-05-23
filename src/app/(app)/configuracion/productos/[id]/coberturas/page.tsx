import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import {
  listTenantProductCoverages,
  listProductsForCoverageCopy,
} from "@/features/products/coverages-queries";
import { ProductCoveragesGrid } from "@/features/products/components/product-coverages-grid";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default async function ProductoCoberturasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { db } = await requireOrgDb();
  const product = await db.insuranceProduct.findFirst({
    where: { id },
    select: {
      id: true,
      name: true,
      insuranceCompany: { select: { name: true } },
    },
  });
  if (!product) notFound();

  const [coverages, otherProducts] = await Promise.all([
    listTenantProductCoverages(db, id),
    listProductsForCoverageCopy(db),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Coberturas: ${product.name}`}
        description={`Compañía: ${product.insuranceCompany.name}`}
      />
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracion/productos">
          <ChevronLeft className="size-4" /> Volver a productos
        </Link>
      </Button>
      <ProductCoveragesGrid
        productId={product.id}
        productName={product.name}
        coverages={coverages}
        otherProducts={otherProducts}
      />
    </div>
  );
}
