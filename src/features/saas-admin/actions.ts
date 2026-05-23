"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireSuperadmin } from "@/server/context";
import {
  globalCompanySchema,
  type GlobalCompanyValues,
  branchTypeSchema,
  type BranchTypeValues,
  branchFieldSchemaSchema,
  type BranchFieldSchemaValues,
  globalProductSchema,
  type GlobalProductValues,
  globalProductCoverageSchema,
  type GlobalProductCoverageValues,
} from "./schemas";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function toNullableString(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

function toDecimalOrNull(v: string): Prisma.Decimal | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return new Prisma.Decimal(n);
}

// ─── Global Companies ───────────────────────────────────────────────

export async function createGlobalCompanyAction(
  raw: GlobalCompanyValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = globalCompanySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { prisma } = await requireSuperadmin();
  try {
    const created = await prisma.globalInsuranceCompany.create({
      data: {
        name: parsed.data.name,
        legalName: toNullableString(parsed.data.legalName),
        rut: toNullableString(parsed.data.rut),
        address: toNullableString(parsed.data.address),
        commune: toNullableString(parsed.data.commune),
        city: toNullableString(parsed.data.city),
        url: toNullableString(parsed.data.url),
        logoUrl: toNullableString(parsed.data.logoUrl),
        isLife: parsed.data.isLife,
        active: parsed.data.active,
      },
    });
    revalidatePath("/admin/companias");
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ya existe una compañía global con ese nombre." };
    }
    throw e;
  }
}

export async function updateGlobalCompanyAction(
  id: string,
  raw: GlobalCompanyValues,
): Promise<ActionResult> {
  const parsed = globalCompanySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { prisma } = await requireSuperadmin();
  try {
    await prisma.globalInsuranceCompany.update({
      where: { id },
      data: {
        name: parsed.data.name,
        legalName: toNullableString(parsed.data.legalName),
        rut: toNullableString(parsed.data.rut),
        address: toNullableString(parsed.data.address),
        commune: toNullableString(parsed.data.commune),
        city: toNullableString(parsed.data.city),
        url: toNullableString(parsed.data.url),
        logoUrl: toNullableString(parsed.data.logoUrl),
        isLife: parsed.data.isLife,
        active: parsed.data.active,
      },
    });
    revalidatePath("/admin/companias");
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ya existe una compañía global con ese nombre." };
    }
    throw e;
  }
}

export async function deleteGlobalCompanyAction(
  id: string,
): Promise<ActionResult> {
  const { prisma } = await requireSuperadmin();
  // Si tiene tenants vinculados, marcamos inactivo en vez de borrar.
  const linked = await prisma.insuranceCompany.count({
    where: { globalCompanyId: id },
  });
  if (linked > 0) {
    await prisma.globalInsuranceCompany.update({
      where: { id },
      data: { active: false },
    });
    revalidatePath("/admin/companias");
    return {
      ok: true,
    };
  }
  await prisma.globalInsuranceCompany.delete({ where: { id } });
  revalidatePath("/admin/companias");
  return { ok: true };
}

// ─── Branch Types ───────────────────────────────────────────────────

export async function createBranchTypeAction(
  raw: BranchTypeValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = branchTypeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { prisma } = await requireSuperadmin();
  try {
    const created = await prisma.branchType.create({
      data: {
        key: parsed.data.key,
        name: parsed.data.name,
        category: parsed.data.category,
        order: Number(parsed.data.order) || 0,
        active: parsed.data.active,
      },
    });
    revalidatePath("/admin/ramos");
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ya existe un ramo con esa clave." };
    }
    throw e;
  }
}

export async function updateBranchTypeAction(
  id: string,
  raw: BranchTypeValues,
): Promise<ActionResult> {
  const parsed = branchTypeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { prisma } = await requireSuperadmin();
  await prisma.branchType.update({
    where: { id },
    data: {
      key: parsed.data.key,
      name: parsed.data.name,
      category: parsed.data.category,
      order: Number(parsed.data.order) || 0,
      active: parsed.data.active,
    },
  });
  revalidatePath("/admin/ramos");
  return { ok: true };
}

export async function upsertBranchFieldAction(
  branchTypeId: string,
  fieldId: string | null,
  raw: BranchFieldSchemaValues,
): Promise<ActionResult> {
  const parsed = branchFieldSchemaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { prisma } = await requireSuperadmin();
  let options: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
  if (parsed.data.type === "select" && parsed.data.options.trim() !== "") {
    try {
      const parsedOpts = JSON.parse(parsed.data.options);
      options = parsedOpts as Prisma.InputJsonValue;
    } catch {
      return { ok: false, error: "JSON de opciones inválido" };
    }
  }
  const data = {
    branchTypeId,
    fieldKey: parsed.data.fieldKey,
    label: parsed.data.label,
    type: parsed.data.type,
    required: parsed.data.required,
    order: Number(parsed.data.order) || 0,
    options,
    helpText: toNullableString(parsed.data.helpText),
  };
  if (fieldId) {
    await prisma.branchFieldSchema.update({ where: { id: fieldId }, data });
  } else {
    await prisma.branchFieldSchema.create({ data });
  }
  revalidatePath("/admin/ramos");
  return { ok: true };
}

export async function deleteBranchFieldAction(
  fieldId: string,
): Promise<ActionResult> {
  const { prisma } = await requireSuperadmin();
  await prisma.branchFieldSchema.delete({ where: { id: fieldId } });
  revalidatePath("/admin/ramos");
  return { ok: true };
}

/**
 * Mueve un campo hacia arriba o abajo intercambiando su `order` con el
 * campo adyacente. Si ya está en el extremo, no-op.
 */
export async function moveBranchFieldAction(
  fieldId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const { prisma } = await requireSuperadmin();
  const current = await prisma.branchFieldSchema.findUnique({
    where: { id: fieldId },
    select: { id: true, order: true, branchTypeId: true },
  });
  if (!current) return { ok: false, error: "Campo no existe." };

  const neighbor = await prisma.branchFieldSchema.findFirst({
    where: {
      branchTypeId: current.branchTypeId,
      order:
        direction === "up"
          ? { lt: current.order }
          : { gt: current.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbor) return { ok: true }; // ya en el extremo, no-op silencioso

  // Intercambio en dos pasos para no violar el unique [branchTypeId,fieldKey]
  // (no aplica acá, pero por consistencia con order). Usamos un valor pivote
  // fuera de rango para evitar colisiones aunque haya constraint en order.
  await prisma.$transaction([
    prisma.branchFieldSchema.update({
      where: { id: current.id },
      data: { order: -1 },
    }),
    prisma.branchFieldSchema.update({
      where: { id: neighbor.id },
      data: { order: current.order },
    }),
    prisma.branchFieldSchema.update({
      where: { id: current.id },
      data: { order: neighbor.order },
    }),
  ]);

  revalidatePath(`/admin/ramos/${current.branchTypeId}`);
  return { ok: true };
}

/**
 * Renumera los `order` de todos los campos de un ramo en pasos de 10,
 * preservando el orden actual. Útil después de mucha edición ad-hoc.
 */
export async function normalizeBranchFieldOrdersAction(
  branchTypeId: string,
): Promise<ActionResult> {
  const { prisma } = await requireSuperadmin();
  const fields = await prisma.branchFieldSchema.findMany({
    where: { branchTypeId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  await prisma.$transaction(
    fields.map((f, idx) =>
      prisma.branchFieldSchema.update({
        where: { id: f.id },
        data: { order: (idx + 1) * 10 },
      }),
    ),
  );
  revalidatePath(`/admin/ramos/${branchTypeId}`);
  return { ok: true };
}

// ─── Global Products ────────────────────────────────────────────────

export async function createGlobalProductAction(
  raw: GlobalProductValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = globalProductSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { prisma } = await requireSuperadmin();
  try {
    const created = await prisma.globalInsuranceProduct.create({
      data: {
        globalCompanyId: parsed.data.globalCompanyId,
        branchTypeId: parsed.data.branchTypeId,
        name: parsed.data.name,
        code: toNullableString(parsed.data.code),
        commissionAffectPct: toDecimalOrNull(parsed.data.commissionAffectPct),
        commissionExemptPct: toDecimalOrNull(parsed.data.commissionExemptPct),
        active: parsed.data.active,
      },
    });
    revalidatePath("/admin/productos");
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ya existe ese producto en la compañía." };
    }
    throw e;
  }
}

export async function updateGlobalProductAction(
  id: string,
  raw: GlobalProductValues,
): Promise<ActionResult> {
  const parsed = globalProductSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { prisma } = await requireSuperadmin();
  await prisma.globalInsuranceProduct.update({
    where: { id },
    data: {
      globalCompanyId: parsed.data.globalCompanyId,
      branchTypeId: parsed.data.branchTypeId,
      name: parsed.data.name,
      code: toNullableString(parsed.data.code),
      commissionAffectPct: toDecimalOrNull(parsed.data.commissionAffectPct),
      commissionExemptPct: toDecimalOrNull(parsed.data.commissionExemptPct),
      active: parsed.data.active,
    },
  });
  revalidatePath("/admin/productos");
  revalidatePath(`/admin/productos/${id}`);
  return { ok: true };
}

export async function deleteGlobalProductAction(
  id: string,
): Promise<ActionResult> {
  const { prisma } = await requireSuperadmin();
  const linked = await prisma.insuranceProduct.count({
    where: { globalProductId: id },
  });
  if (linked > 0) {
    await prisma.globalInsuranceProduct.update({
      where: { id },
      data: { active: false },
    });
    revalidatePath("/admin/productos");
    return { ok: true };
  }
  await prisma.globalInsuranceProduct.delete({ where: { id } });
  revalidatePath("/admin/productos");
  return { ok: true };
}

export async function upsertProductCoverageAction(
  productId: string,
  coverageId: string | null,
  raw: GlobalProductCoverageValues,
): Promise<ActionResult> {
  const parsed = globalProductCoverageSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { prisma } = await requireSuperadmin();
  const data = {
    globalProductId: productId,
    order: Number(parsed.data.order) || 0,
    name: parsed.data.name,
    polCad: toNullableString(parsed.data.polCad),
    text: toNullableString(parsed.data.text),
    insuredAmount: toDecimalOrNull(parsed.data.insuredAmount),
    type: parsed.data.type,
    isCommercialValue: parsed.data.isCommercialValue,
    affectedByIva: parsed.data.affectedByIva,
    sumsToTotal: parsed.data.sumsToTotal,
  };
  if (coverageId) {
    await prisma.globalProductCoverage.update({
      where: { id: coverageId },
      data,
    });
  } else {
    await prisma.globalProductCoverage.create({ data });
  }
  revalidatePath(`/admin/productos/${productId}`);
  return { ok: true };
}

export async function deleteProductCoverageAction(
  coverageId: string,
): Promise<ActionResult> {
  const { prisma } = await requireSuperadmin();
  const cov = await prisma.globalProductCoverage.findUnique({
    where: { id: coverageId },
    select: { globalProductId: true },
  });
  await prisma.globalProductCoverage.delete({ where: { id: coverageId } });
  if (cov) revalidatePath(`/admin/productos/${cov.globalProductId}`);
  return { ok: true };
}
