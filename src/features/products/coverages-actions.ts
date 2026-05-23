"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import {
  tenantCoverageFormSchema,
  type TenantCoverageFormValues,
} from "./coverages-schemas";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function toDecimal(v: string): Prisma.Decimal | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return new Prisma.Decimal(n);
}

function toNull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

export async function createTenantCoverageAction(
  productId: string,
  raw: TenantCoverageFormValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = tenantCoverageFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { ctx, db } = await requireOrgDb();
  const product = await db.insuranceProduct.findFirst({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) return { ok: false, error: "Producto no existe." };

  const created = await db.tenantProductCoverage.create({
    data: {
      organizationId: ctx.organizationId,
      productId,
      order: Number(parsed.data.order) || 0,
      name: parsed.data.name,
      factor: toDecimal(parsed.data.factor),
      polCad: toNull(parsed.data.polCad),
      text: toNull(parsed.data.text),
      isCommercialValue: parsed.data.isCommercialValue,
      insuredAmount: toDecimal(parsed.data.insuredAmount),
      type: parsed.data.type,
      affectedByIva: parsed.data.affectedByIva,
      sumsToTotal: parsed.data.sumsToTotal,
      premium: toDecimal(parsed.data.premium),
    },
    select: { id: true },
  });
  revalidatePath("/configuracion/productos");
  return { ok: true, data: { id: created.id } };
}

export async function updateTenantCoverageAction(
  coverageId: string,
  raw: TenantCoverageFormValues,
): Promise<ActionResult> {
  const parsed = tenantCoverageFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { db } = await requireOrgDb();
  const existing = await db.tenantProductCoverage.findFirst({
    where: { id: coverageId },
  });
  if (!existing) return { ok: false, error: "Cobertura no existe." };

  await db.tenantProductCoverage.update({
    where: { id: coverageId },
    data: {
      order: Number(parsed.data.order) || 0,
      name: parsed.data.name,
      factor: toDecimal(parsed.data.factor),
      polCad: toNull(parsed.data.polCad),
      text: toNull(parsed.data.text),
      isCommercialValue: parsed.data.isCommercialValue,
      insuredAmount: toDecimal(parsed.data.insuredAmount),
      type: parsed.data.type,
      affectedByIva: parsed.data.affectedByIva,
      sumsToTotal: parsed.data.sumsToTotal,
      premium: toDecimal(parsed.data.premium),
    },
  });
  revalidatePath("/configuracion/productos");
  return { ok: true };
}

export async function deleteTenantCoverageAction(
  coverageId: string,
): Promise<ActionResult> {
  const { db } = await requireOrgDb();
  const cov = await db.tenantProductCoverage.findFirst({
    where: { id: coverageId },
    select: { id: true },
  });
  if (!cov) return { ok: false, error: "Cobertura no existe." };
  await db.tenantProductCoverage.delete({ where: { id: coverageId } });
  revalidatePath("/configuracion/productos");
  return { ok: true };
}

/**
 * Copia todas las coberturas activas de `sourceProductId` a `targetProductId`
 * dentro de la misma organización. No elimina las existentes en destino.
 */
export async function bulkCopyCoveragesAction(
  sourceProductId: string,
  targetProductId: string,
): Promise<ActionResult<{ count: number }>> {
  if (sourceProductId === targetProductId) {
    return {
      ok: false,
      error: "El producto origen y destino deben ser distintos.",
    };
  }
  const { ctx, db } = await requireOrgDb();
  const [source, target] = await Promise.all([
    db.insuranceProduct.findFirst({
      where: { id: sourceProductId },
      select: { id: true },
    }),
    db.insuranceProduct.findFirst({
      where: { id: targetProductId },
      select: { id: true },
    }),
  ]);
  if (!source || !target) {
    return { ok: false, error: "Producto origen o destino no existe." };
  }

  const coverages = await db.tenantProductCoverage.findMany({
    where: { productId: sourceProductId },
    orderBy: { order: "asc" },
  });
  if (coverages.length === 0) {
    return {
      ok: false,
      error: "El producto origen no tiene coberturas para copiar.",
    };
  }

  const last = await db.tenantProductCoverage.findFirst({
    where: { productId: targetProductId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  let nextOrder = (last?.order ?? 0) + 10;

  await db.tenantProductCoverage.createMany({
    data: coverages.map((c) => ({
      organizationId: ctx.organizationId,
      productId: targetProductId,
      order: (nextOrder += 10),
      name: c.name,
      factor: c.factor,
      polCad: c.polCad,
      text: c.text,
      isCommercialValue: c.isCommercialValue,
      insuredAmount: c.insuredAmount,
      type: c.type,
      affectedByIva: c.affectedByIva,
      sumsToTotal: c.sumsToTotal,
      premium: c.premium,
    })),
  });

  revalidatePath("/configuracion/productos");
  return { ok: true, data: { count: coverages.length } };
}
