import "server-only";
import { basePrisma, type Db } from "@/server/db";

export type TenantCompanyRow = {
  id: string;                     // InsuranceCompany.id (tenant row)
  isCustom: boolean;
  globalCompanyId: string | null;
  // Datos heredados/derivados (de global o custom):
  name: string;
  legalName: string | null;
  rut: string | null;
  address: string | null;
  commune: string | null;
  city: string | null;
  url: string | null;
  logoUrl: string | null;
  isLife: boolean;
  status: string;
  // Operativos del corredor:
  brokerCode: string | null;
  paymentLink: string | null;
  bankAccountClp: string | null;
  bankAccountUsd: string | null;
  defaultEmail: string | null;
  contactsCount: number;
};

export type AvailableGlobalCompany = {
  id: string;
  name: string;
  legalName: string | null;
  rut: string | null;
  isLife: boolean;
};

export type CompanyContactRow = {
  id: string;
  name: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  celular: string | null;
  role: string | null;
  isDefault: boolean;
};

/** Compañías que el tenant ya tiene (adoptadas o custom). */
export async function listTenantCompanies(db: Db): Promise<TenantCompanyRow[]> {
  const rows = await db.insuranceCompany.findMany({
    orderBy: { name: "asc" },
    include: {
      globalCompany: true,
      _count: { select: { contacts: true } },
    },
  });
  return rows.map((r) => {
    const g = r.globalCompany;
    return {
      id: r.id,
      isCustom: r.globalCompanyId === null,
      globalCompanyId: r.globalCompanyId,
      name: g?.name ?? r.name,
      legalName: g?.legalName ?? r.legalName,
      rut: g?.rut ?? r.rut,
      address: g?.address ?? r.address,
      commune: g?.commune ?? r.commune,
      city: g?.city ?? r.city,
      url: g?.url ?? r.url,
      logoUrl: g?.logoUrl ?? r.logoUrl,
      isLife: g?.isLife ?? r.isLife,
      status: r.status,
      brokerCode: r.brokerCode,
      paymentLink: r.paymentLink,
      bankAccountClp: r.bankAccountClp,
      bankAccountUsd: r.bankAccountUsd,
      defaultEmail: r.defaultEmail,
      contactsCount: r._count.contacts,
    };
  });
}

/** Compañías globales que el tenant NO ha adoptado aún. */
export async function listAvailableGlobalCompanies(
  organizationId: string,
): Promise<AvailableGlobalCompany[]> {
  const adopted = await basePrisma.insuranceCompany.findMany({
    where: { organizationId, globalCompanyId: { not: null } },
    select: { globalCompanyId: true },
  });
  const adoptedIds = adopted
    .map((r) => r.globalCompanyId)
    .filter((id): id is string => id !== null);
  const rows = await basePrisma.globalInsuranceCompany.findMany({
    where: { active: true, id: { notIn: adoptedIds } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      legalName: true,
      rut: true,
      isLife: true,
    },
  });
  return rows;
}

/** Detalle de una compañía del tenant (con contactos). */
export async function getTenantCompany(db: Db, id: string) {
  const r = await db.insuranceCompany.findUnique({
    where: { id },
    include: {
      globalCompany: true,
      contacts: { orderBy: [{ isDefault: "desc" }, { name: "asc" }] },
    },
  });
  return r;
}

export type TenantProductRow = {
  id: string;
  name: string;
  code: string | null;
  isCustom: boolean;
  globalProductId: string | null;
  insuranceCompanyId: string;
  insuranceCompanyName: string;
  branchTypeId: string | null;
  branchTypeName: string | null;
  commissionAffectPct: number | null;
  commissionExemptPct: number | null;
  globalCommissionAffectPct: number | null;
  globalCommissionExemptPct: number | null;
  active: boolean;
  coveragesCount: number;
};

export async function listTenantProducts(db: Db): Promise<TenantProductRow[]> {
  const rows = await db.insuranceProduct.findMany({
    orderBy: [{ insuranceCompany: { name: "asc" } }, { name: "asc" }],
    include: {
      globalProduct: true,
      insuranceCompany: { select: { id: true, name: true } },
      branchType: { select: { id: true, name: true } },
      _count: { select: { coverages: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    isCustom: r.globalProductId === null,
    globalProductId: r.globalProductId,
    insuranceCompanyId: r.insuranceCompany.id,
    insuranceCompanyName: r.insuranceCompany.name,
    branchTypeId: r.branchType?.id ?? r.globalProduct?.branchTypeId ?? null,
    branchTypeName: r.branchType?.name ?? null,
    commissionAffectPct: r.commissionAffectPct ? Number(r.commissionAffectPct) : null,
    commissionExemptPct: r.commissionExemptPct ? Number(r.commissionExemptPct) : null,
    globalCommissionAffectPct: r.globalProduct?.commissionAffectPct
      ? Number(r.globalProduct.commissionAffectPct)
      : null,
    globalCommissionExemptPct: r.globalProduct?.commissionExemptPct
      ? Number(r.globalProduct.commissionExemptPct)
      : null,
    active: r.active,
    coveragesCount: r._count.coverages,
  }));
}

/** Productos globales adoptables (con la compañía global adoptada por el tenant). */
export async function listAvailableGlobalProducts(organizationId: string) {
  const tenantCompanies = await basePrisma.insuranceCompany.findMany({
    where: { organizationId, globalCompanyId: { not: null } },
    select: { id: true, globalCompanyId: true, name: true },
  });
  const adoptedProducts = await basePrisma.insuranceProduct.findMany({
    where: { organizationId, globalProductId: { not: null } },
    select: { globalProductId: true },
  });
  const adoptedSet = new Set(
    adoptedProducts
      .map((p) => p.globalProductId)
      .filter((id): id is string => id !== null),
  );
  const globalCompanyIds = tenantCompanies
    .map((c) => c.globalCompanyId)
    .filter((id): id is string => id !== null);
  if (globalCompanyIds.length === 0) return [];
  const rows = await basePrisma.globalInsuranceProduct.findMany({
    where: {
      active: true,
      globalCompanyId: { in: globalCompanyIds },
      id: { notIn: Array.from(adoptedSet) },
    },
    orderBy: [{ globalCompany: { name: "asc" } }, { name: "asc" }],
    include: {
      globalCompany: { select: { id: true, name: true } },
      branchType: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => {
    const tenantCompany = tenantCompanies.find(
      (tc) => tc.globalCompanyId === r.globalCompanyId,
    );
    return {
      globalProductId: r.id,
      productName: r.name,
      productCode: r.code,
      globalCompanyId: r.globalCompanyId,
      globalCompanyName: r.globalCompany.name,
      branchTypeId: r.branchTypeId,
      branchTypeName: r.branchType.name,
      tenantCompanyId: tenantCompany?.id ?? null,
      tenantCompanyName: tenantCompany?.name ?? null,
      commissionAffectPct: r.commissionAffectPct ? Number(r.commissionAffectPct) : null,
      commissionExemptPct: r.commissionExemptPct ? Number(r.commissionExemptPct) : null,
    };
  });
}
