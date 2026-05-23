import "server-only";
import type { Db } from "@/server/db";

export type ProductCoverageRow = {
  id: string;
  order: number;
  name: string;
  factor: number | null;
  polCad: string | null;
  text: string | null;
  isCommercialValue: boolean;
  insuredAmount: number | null;
  type: string;
  affectedByIva: boolean;
  sumsToTotal: boolean;
  premium: number | null;
};

function asNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export async function listTenantProductCoverages(
  db: Db,
  productId: string,
): Promise<ProductCoverageRow[]> {
  const rows = await db.tenantProductCoverage.findMany({
    where: { productId },
    orderBy: { order: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    order: r.order,
    name: r.name,
    factor: asNumber(r.factor),
    polCad: r.polCad,
    text: r.text,
    isCommercialValue: r.isCommercialValue,
    insuredAmount: asNumber(r.insuredAmount),
    type: r.type,
    affectedByIva: r.affectedByIva,
    sumsToTotal: r.sumsToTotal,
    premium: asNumber(r.premium),
  }));
}

/** Productos del tenant (id + nombre + compañía) para selector "Copiar coberturas de…". */
export async function listProductsForCoverageCopy(db: Db) {
  return db.insuranceProduct.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      insuranceCompany: { select: { name: true } },
    },
  });
}
