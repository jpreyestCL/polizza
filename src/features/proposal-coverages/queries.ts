import "server-only";
import type { Db } from "@/server/db";

export type ItemCoverageRow = {
  id: string;
  order: number;
  name: string;
  polCad: string | null;
  type: string;
  isCommercialValue: boolean;
  insuredAmount: number | null;
  insuredCurrency: string;
  affectedByIva: boolean;
  taxRateAffect: number | null;
  taxRateExempt: number | null;
  premiumAffect: number | null;
  premiumExempt: number | null;
  premiumNet: number | null;
  ivaAmount: number | null;
  premiumGross: number | null;
  commissionAffectPct: number | null;
  commissionExemptPct: number | null;
  commissionAmount: number | null;
  sumsToTotal: boolean;
  manualPremium: boolean;
  autoLoaded: boolean;
};

function asNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export async function listItemCoverages(
  db: Db,
  itemId: string,
): Promise<ItemCoverageRow[]> {
  const rows = await db.proposalItemCoverage.findMany({
    where: { itemId },
    orderBy: { order: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    order: r.order,
    name: r.name,
    polCad: r.polCad,
    type: r.type,
    isCommercialValue: r.isCommercialValue,
    insuredAmount: asNumber(r.insuredAmount),
    insuredCurrency: r.insuredCurrency,
    affectedByIva: r.affectedByIva,
    taxRateAffect: asNumber(r.taxRateAffect),
    taxRateExempt: asNumber(r.taxRateExempt),
    premiumAffect: asNumber(r.premiumAffect),
    premiumExempt: asNumber(r.premiumExempt),
    premiumNet: asNumber(r.premiumNet),
    ivaAmount: asNumber(r.ivaAmount),
    premiumGross: asNumber(r.premiumGross),
    commissionAffectPct: asNumber(r.commissionAffectPct),
    commissionExemptPct: asNumber(r.commissionExemptPct),
    commissionAmount: asNumber(r.commissionAmount),
    sumsToTotal: r.sumsToTotal,
    manualPremium: r.manualPremium,
    autoLoaded: r.autoLoaded,
  }));
}

/** Coberturas predefinidas del producto del tenant (para botón "Copiar coberturas"). */
export async function getProductCoverages(db: Db, productId: string) {
  const product = await db.insuranceProduct.findFirst({
    where: { id: productId },
    include: {
      globalProduct: {
        include: {
          coverages: { orderBy: { order: "asc" } },
        },
      },
      coverages: { orderBy: { order: "asc" } },
    },
  });
  if (!product) return [];
  const tenantCoverages = product.coverages;
  const globalCoverages = product.globalProduct?.coverages ?? [];
  // Las custom del tenant priman; si no hay, se usan las del global.
  return tenantCoverages.length > 0 ? tenantCoverages : globalCoverages;
}
