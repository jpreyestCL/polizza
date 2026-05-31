"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import {
  itemCoverageSchema,
  itemCoveragesBulkSchema,
  computeCoverage,
  resolvePremium,
  type ItemCoverageValues,
  type ItemCoveragesBulkValues,
} from "./schemas";
import { getProductCoverages } from "./queries";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function toDecimal(v: string | number): Prisma.Decimal | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return null;
  return new Prisma.Decimal(n);
}

function toNullableString(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

export async function upsertItemCoverageAction(
  itemId: string,
  coverageId: string | null,
  raw: ItemCoverageValues,
): Promise<ActionResult> {
  const parsed = itemCoverageSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { ctx, db } = await requireOrgDb();
  const item = await db.proposalItem.findFirst({
    where: { id: itemId },
    select: { id: true, proposalId: true },
  });
  if (!item) return { ok: false, error: "Ítem no existe." };

  const calc = computeCoverage(parsed.data);
  const data = {
    organizationId: ctx.organizationId,
    itemId,
    order: Number(parsed.data.order) || 0,
    name: parsed.data.name,
    polCad: toNullableString(parsed.data.polCad),
    type: parsed.data.type,
    isCommercialValue: parsed.data.isCommercialValue,
    insuredAmount: toDecimal(parsed.data.insuredAmount),
    insuredCurrency: parsed.data.insuredCurrency,
    affectedByIva: parsed.data.affectedByIva,
    taxRateAffect: toDecimal(parsed.data.taxRateAffect),
    taxRateExempt: toDecimal(parsed.data.taxRateExempt),
    premiumAffect: toDecimal(
      String(
        resolvePremium(
          parsed.data.manualPremium,
          parsed.data.taxRateAffect,
          parsed.data.premiumAffect,
          Number(parsed.data.insuredAmount) || 0,
        ),
      ),
    ),
    premiumExempt: toDecimal(
      String(
        resolvePremium(
          parsed.data.manualPremium,
          parsed.data.taxRateExempt,
          parsed.data.premiumExempt,
          Number(parsed.data.insuredAmount) || 0,
        ),
      ),
    ),
    premiumNet: toDecimal(calc.premiumNet),
    ivaAmount: toDecimal(calc.ivaAmount),
    premiumGross: toDecimal(calc.premiumGross),
    commissionAffectPct: toDecimal(parsed.data.commissionAffectPct),
    commissionExemptPct: toDecimal(parsed.data.commissionExemptPct),
    commissionAmount: toDecimal(calc.commissionAmount),
    sumsToTotal: parsed.data.sumsToTotal,
    manualPremium: parsed.data.manualPremium,
  };

  if (coverageId) {
    // Editar limpia la marca de cobertura auto-cargada (extension D).
    await db.proposalItemCoverage.update({
      where: { id: coverageId },
      data: { ...data, autoLoaded: false },
    });
  } else {
    await db.proposalItemCoverage.create({ data });
  }
  revalidatePath(`/propuestas/${item.proposalId}`);
  return { ok: true };
}

/** Construye los datos persistibles (con primas calculadas) de una cobertura. */
function buildCoverageData(
  organizationId: string,
  itemId: string,
  v: ItemCoverageValues,
) {
  const calc = computeCoverage(v);
  const insured = Number(v.insuredAmount) || 0;
  return {
    organizationId,
    itemId,
    order: Number(v.order) || 0,
    name: v.name,
    polCad: toNullableString(v.polCad),
    type: v.type,
    isCommercialValue: v.isCommercialValue,
    insuredAmount: toDecimal(v.insuredAmount),
    insuredCurrency: v.insuredCurrency,
    affectedByIva: v.affectedByIva,
    taxRateAffect: toDecimal(v.taxRateAffect),
    taxRateExempt: toDecimal(v.taxRateExempt),
    premiumAffect: toDecimal(
      String(resolvePremium(v.manualPremium, v.taxRateAffect, v.premiumAffect, insured)),
    ),
    premiumExempt: toDecimal(
      String(resolvePremium(v.manualPremium, v.taxRateExempt, v.premiumExempt, insured)),
    ),
    premiumNet: toDecimal(calc.premiumNet),
    ivaAmount: toDecimal(calc.ivaAmount),
    premiumGross: toDecimal(calc.premiumGross),
    commissionAffectPct: toDecimal(v.commissionAffectPct),
    commissionExemptPct: toDecimal(v.commissionExemptPct),
    commissionAmount: toDecimal(calc.commissionAmount),
    sumsToTotal: v.sumsToTotal,
    manualPremium: v.manualPremium,
  };
}

/**
 * Grabado masivo del grid inline de coberturas: crea/actualiza las filas
 * recibidas y elimina las que ya no están. Editar NO borra los datos de la
 * cobertura (obs. 6): se preservan todos los campos enviados.
 */
export async function saveItemCoveragesAction(
  itemId: string,
  raw: ItemCoveragesBulkValues,
): Promise<ActionResult<{ count: number }>> {
  const parsed = itemCoveragesBulkSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  const { ctx, db } = await requireOrgDb();
  const item = await db.proposalItem.findFirst({
    where: { id: itemId },
    select: { id: true, proposalId: true },
  });
  if (!item) return { ok: false, error: "Ítem no existe." };

  const existing = await db.proposalItemCoverage.findMany({
    where: { itemId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((c) => c.id));
  const keptIds = new Set<string>();

  // Reordena según la posición del grid (order = índice * 10).
  let order = 0;
  for (const row of parsed.data.rows) {
    order += 10;
    const data = buildCoverageData(ctx.organizationId, itemId, {
      ...row,
      order: String(order),
    });
    if (row.id && existingIds.has(row.id)) {
      keptIds.add(row.id);
      await db.proposalItemCoverage.update({
        where: { id: row.id },
        data: { ...data, autoLoaded: false },
      });
    } else {
      await db.proposalItemCoverage.create({ data });
    }
  }

  // Elimina las coberturas que el usuario quitó del grid.
  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
  if (toDelete.length > 0) {
    await db.proposalItemCoverage.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  revalidatePath(`/propuestas/${item.proposalId}`);
  return { ok: true, data: { count: parsed.data.rows.length } };
}

export async function deleteItemCoverageAction(
  coverageId: string,
): Promise<ActionResult> {
  const { db } = await requireOrgDb();
  const cov = await db.proposalItemCoverage.findFirst({
    where: { id: coverageId },
    select: { itemId: true, item: { select: { proposalId: true } } },
  });
  if (!cov) return { ok: false, error: "Cobertura no existe." };
  await db.proposalItemCoverage.delete({ where: { id: coverageId } });
  revalidatePath(`/propuestas/${cov.item.proposalId}`);
  return { ok: true };
}

/** Copia las coberturas predefinidas del producto al ítem. */
export async function copyProductCoveragesAction(
  itemId: string,
): Promise<ActionResult<{ count: number }>> {
  const { ctx, db } = await requireOrgDb();
  const item = await db.proposalItem.findFirst({
    where: { id: itemId },
    select: { id: true, proposalId: true, proposal: { select: { productId: true } } },
  });
  if (!item) return { ok: false, error: "Ítem no existe." };
  if (!item.proposal.productId) {
    return {
      ok: false,
      error: "La propuesta no tiene producto asignado para copiar coberturas.",
    };
  }
  const coverages = await getProductCoverages(db, item.proposal.productId);
  if (coverages.length === 0) {
    return {
      ok: false,
      error: "El producto no tiene coberturas predefinidas.",
    };
  }

  const last = await db.proposalItemCoverage.findFirst({
    where: { itemId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  let nextOrder = (last?.order ?? 0) + 10;

  await db.proposalItemCoverage.createMany({
    data: coverages.map((c) => ({
      organizationId: ctx.organizationId,
      itemId,
      order: (nextOrder += 10),
      name: c.name,
      polCad: c.polCad,
      type: c.type,
      isCommercialValue: c.isCommercialValue,
      insuredAmount: c.insuredAmount,
      insuredCurrency: "UF",
      affectedByIva: c.affectedByIva,
      sumsToTotal: c.sumsToTotal,
    })),
  });

  revalidatePath(`/propuestas/${item.proposalId}`);
  return { ok: true, data: { count: coverages.length } };
}
