"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { basePrisma } from "@/server/db";
import {
  tenantCompanyOperativeSchema,
  type TenantCompanyOperativeValues,
  tenantCustomCompanySchema,
  type TenantCustomCompanyValues,
  companyContactSchema,
  type CompanyContactValues,
  tenantCustomProductSchema,
  type TenantCustomProductValues,
  tenantProductOverrideSchema,
  type TenantProductOverrideValues,
} from "./schemas";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function toNullable(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

function toDecimalOrNull(v: string): Prisma.Decimal | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return new Prisma.Decimal(n);
}

// ─── Compañías del tenant ───────────────────────────────────────────

/** Adopta una compañía global creando una `InsuranceCompany` que la referencia. */
export async function adoptGlobalCompanyAction(
  globalCompanyId: string,
): Promise<ActionResult<{ id: string }>> {
  const { ctx, db } = await requireOrgDb();
  const global = await basePrisma.globalInsuranceCompany.findUnique({
    where: { id: globalCompanyId },
  });
  if (!global) {
    return { ok: false, error: "Compañía global no existe." };
  }
  try {
    const created = await db.insuranceCompany.create({
      data: {
        organizationId: ctx.organizationId,
        globalCompanyId: global.id,
        name: global.name, // requerido en el modelo; se mantiene sincronizado con el global vía queries
        isLife: global.isLife,
        status: "ACTIVA",
      },
      select: { id: true },
    });
    revalidatePath("/configuracion/companias");
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Esa compañía ya está en tu maestro." };
    }
    throw e;
  }
}

export async function updateTenantCompanyOperativeAction(
  id: string,
  raw: TenantCompanyOperativeValues,
): Promise<ActionResult> {
  const parsed = tenantCompanyOperativeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { db } = await requireOrgDb();
  await db.insuranceCompany.update({
    where: { id },
    data: {
      brokerCode: toNullable(parsed.data.brokerCode),
      paymentLink: toNullable(parsed.data.paymentLink),
      bankAccountClp: toNullable(parsed.data.bankAccountClp),
      bankAccountUsd: toNullable(parsed.data.bankAccountUsd),
      defaultEmail: toNullable(parsed.data.defaultEmail),
      status: parsed.data.status,
    },
  });
  revalidatePath("/configuracion/companias");
  revalidatePath(`/configuracion/companias/${id}`);
  return { ok: true };
}

export async function createCustomCompanyAction(
  raw: TenantCustomCompanyValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = tenantCustomCompanySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { ctx, db } = await requireOrgDb();
  const created = await db.insuranceCompany.create({
    data: {
      organizationId: ctx.organizationId,
      globalCompanyId: null,
      name: parsed.data.name,
      legalName: toNullable(parsed.data.legalName),
      rut: toNullable(parsed.data.rut),
      address: toNullable(parsed.data.address),
      commune: toNullable(parsed.data.commune),
      city: toNullable(parsed.data.city),
      url: toNullable(parsed.data.url),
      logoUrl: toNullable(parsed.data.logoUrl),
      isLife: parsed.data.isLife,
      brokerCode: toNullable(parsed.data.brokerCode),
      paymentLink: toNullable(parsed.data.paymentLink),
      bankAccountClp: toNullable(parsed.data.bankAccountClp),
      bankAccountUsd: toNullable(parsed.data.bankAccountUsd),
      defaultEmail: toNullable(parsed.data.defaultEmail),
      status: "ACTIVA",
    },
    select: { id: true },
  });
  revalidatePath("/configuracion/companias");
  return { ok: true, data: { id: created.id } };
}

export async function updateCustomCompanyAction(
  id: string,
  raw: TenantCustomCompanyValues,
): Promise<ActionResult> {
  const parsed = tenantCustomCompanySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { db } = await requireOrgDb();
  await db.insuranceCompany.update({
    where: { id },
    data: {
      name: parsed.data.name,
      legalName: toNullable(parsed.data.legalName),
      rut: toNullable(parsed.data.rut),
      address: toNullable(parsed.data.address),
      commune: toNullable(parsed.data.commune),
      city: toNullable(parsed.data.city),
      url: toNullable(parsed.data.url),
      logoUrl: toNullable(parsed.data.logoUrl),
      isLife: parsed.data.isLife,
      brokerCode: toNullable(parsed.data.brokerCode),
      paymentLink: toNullable(parsed.data.paymentLink),
      bankAccountClp: toNullable(parsed.data.bankAccountClp),
      bankAccountUsd: toNullable(parsed.data.bankAccountUsd),
      defaultEmail: toNullable(parsed.data.defaultEmail),
    },
  });
  revalidatePath("/configuracion/companias");
  revalidatePath(`/configuracion/companias/${id}`);
  return { ok: true };
}

export async function deleteTenantCompanyAction(
  id: string,
): Promise<ActionResult> {
  const { db } = await requireOrgDb();
  // Si tiene productos enlazados, marca inactiva en vez de borrar.
  const linked = await db.insuranceProduct.count({
    where: { insuranceCompanyId: id },
  });
  if (linked > 0) {
    await db.insuranceCompany.update({
      where: { id },
      data: { status: "INACTIVA" },
    });
    revalidatePath("/configuracion/companias");
    return { ok: true };
  }
  await db.insuranceCompany.delete({ where: { id } });
  revalidatePath("/configuracion/companias");
  return { ok: true };
}

// ─── Contactos de compañía ──────────────────────────────────────────

export async function upsertCompanyContactAction(
  insuranceCompanyId: string,
  contactId: string | null,
  raw: CompanyContactValues,
): Promise<ActionResult> {
  const parsed = companyContactSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { ctx, db } = await requireOrgDb();
  const data = {
    organizationId: ctx.organizationId,
    insuranceCompanyId,
    name: parsed.data.name,
    lastName: toNullable(parsed.data.lastName),
    email: toNullable(parsed.data.email),
    phone: toNullable(parsed.data.phone),
    celular: toNullable(parsed.data.celular),
    role: toNullable(parsed.data.role),
    isDefault: parsed.data.isDefault,
  };
  if (parsed.data.isDefault) {
    // Solo uno por defecto; los demás se desmarcan
    await db.insuranceCompanyContact.updateMany({
      where: { insuranceCompanyId, isDefault: true, ...(contactId ? { NOT: { id: contactId } } : {}) },
      data: { isDefault: false },
    });
  }
  if (contactId) {
    await db.insuranceCompanyContact.update({
      where: { id: contactId },
      data,
    });
  } else {
    await db.insuranceCompanyContact.create({ data });
  }
  revalidatePath(`/configuracion/companias/${insuranceCompanyId}`);
  return { ok: true };
}

export async function deleteCompanyContactAction(
  contactId: string,
): Promise<ActionResult> {
  const { db } = await requireOrgDb();
  const contact = await db.insuranceCompanyContact.findUnique({
    where: { id: contactId },
    select: { insuranceCompanyId: true },
  });
  await db.insuranceCompanyContact.delete({ where: { id: contactId } });
  if (contact) revalidatePath(`/configuracion/companias/${contact.insuranceCompanyId}`);
  return { ok: true };
}

// ─── Productos del tenant ───────────────────────────────────────────

/** Adopta un producto global; copia el % comisión default. */
export async function adoptGlobalProductAction(
  globalProductId: string,
): Promise<ActionResult<{ id: string }>> {
  const { ctx, db } = await requireOrgDb();
  const product = await basePrisma.globalInsuranceProduct.findUnique({
    where: { id: globalProductId },
  });
  if (!product) return { ok: false, error: "Producto global no existe." };
  const tenantCompany = await db.insuranceCompany.findFirst({
    where: { globalCompanyId: product.globalCompanyId },
    select: { id: true },
  });
  if (!tenantCompany) {
    return {
      ok: false,
      error: "Debes adoptar primero la compañía aseguradora.",
    };
  }
  try {
    const created = await db.insuranceProduct.create({
      data: {
        organizationId: ctx.organizationId,
        globalProductId: product.id,
        insuranceCompanyId: tenantCompany.id,
        branchTypeId: product.branchTypeId,
        name: product.name,
        code: product.code,
        commissionAffectPct: product.commissionAffectPct,
        commissionExemptPct: product.commissionExemptPct,
        active: true,
      },
      select: { id: true },
    });
    revalidatePath("/configuracion/productos");
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ese producto ya está en tu maestro." };
    }
    throw e;
  }
}

export async function createCustomProductAction(
  raw: TenantCustomProductValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = tenantCustomProductSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { ctx, db } = await requireOrgDb();
  const created = await db.insuranceProduct.create({
    data: {
      organizationId: ctx.organizationId,
      globalProductId: null,
      insuranceCompanyId: parsed.data.insuranceCompanyId,
      branchTypeId: parsed.data.branchTypeId,
      name: parsed.data.name,
      code: toNullable(parsed.data.code),
      commissionAffectPct: toDecimalOrNull(parsed.data.commissionAffectPct),
      commissionExemptPct: toDecimalOrNull(parsed.data.commissionExemptPct),
      active: parsed.data.active,
    },
    select: { id: true },
  });
  revalidatePath("/configuracion/productos");
  return { ok: true, data: { id: created.id } };
}

export async function updateTenantProductAction(
  id: string,
  raw: TenantProductOverrideValues,
): Promise<ActionResult> {
  const parsed = tenantProductOverrideSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { db } = await requireOrgDb();
  await db.insuranceProduct.update({
    where: { id },
    data: {
      commissionAffectPct: toDecimalOrNull(parsed.data.commissionAffectPct),
      commissionExemptPct: toDecimalOrNull(parsed.data.commissionExemptPct),
      active: parsed.data.active,
    },
  });
  revalidatePath("/configuracion/productos");
  return { ok: true };
}

export async function deleteTenantProductAction(
  id: string,
): Promise<ActionResult> {
  const { db } = await requireOrgDb();
  await db.insuranceProduct.update({
    where: { id },
    data: { active: false },
  });
  revalidatePath("/configuracion/productos");
  return { ok: true };
}
