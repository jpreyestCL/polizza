import "server-only";
import { basePrisma } from "@/server/db";

export type GlobalCompanyRow = {
  id: string;
  name: string;
  legalName: string | null;
  rut: string | null;
  address: string | null;
  commune: string | null;
  city: string | null;
  url: string | null;
  logoUrl: string | null;
  isLife: boolean;
  active: boolean;
  productsCount: number;
};

export async function listGlobalCompanies(): Promise<GlobalCompanyRow[]> {
  const rows = await basePrisma.globalInsuranceCompany.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    legalName: r.legalName,
    rut: r.rut,
    address: r.address,
    commune: r.commune,
    city: r.city,
    url: r.url,
    logoUrl: r.logoUrl,
    isLife: r.isLife,
    active: r.active,
    productsCount: r._count.products,
  }));
}

export type BranchTypeRow = {
  id: string;
  key: string;
  name: string;
  category: string;
  order: number;
  active: boolean;
  fieldsCount: number;
};

export async function listBranchTypes(): Promise<BranchTypeRow[]> {
  const rows = await basePrisma.branchType.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { fieldSchemas: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    category: r.category,
    order: r.order,
    active: r.active,
    fieldsCount: r._count.fieldSchemas,
  }));
}

export type GlobalProductRow = {
  id: string;
  name: string;
  code: string | null;
  commissionAffectPct: number | null;
  commissionExemptPct: number | null;
  active: boolean;
  branchTypeId: string;
  branchTypeName: string;
  globalCompanyId: string;
  globalCompanyName: string;
  coveragesCount: number;
};

export async function listGlobalProducts(): Promise<GlobalProductRow[]> {
  const rows = await basePrisma.globalInsuranceProduct.findMany({
    orderBy: [{ globalCompany: { name: "asc" } }, { name: "asc" }],
    include: {
      branchType: { select: { id: true, name: true } },
      globalCompany: { select: { id: true, name: true } },
      _count: { select: { coverages: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    commissionAffectPct: r.commissionAffectPct ? Number(r.commissionAffectPct) : null,
    commissionExemptPct: r.commissionExemptPct ? Number(r.commissionExemptPct) : null,
    active: r.active,
    branchTypeId: r.branchType.id,
    branchTypeName: r.branchType.name,
    globalCompanyId: r.globalCompany.id,
    globalCompanyName: r.globalCompany.name,
    coveragesCount: r._count.coverages,
  }));
}

export type GlobalProductCoverageRow = {
  id: string;
  order: number;
  name: string;
  polCad: string | null;
  text: string | null;
  insuredAmount: number | null;
  type: string;
  isCommercialValue: boolean;
  affectedByIva: boolean;
  sumsToTotal: boolean;
};

// ─── Vehículos ──────────────────────────────────────────────────────

export type VehicleBrandRow = {
  id: string;
  name: string;
  active: boolean;
  modelsCount: number;
};

export async function listVehicleBrands(): Promise<VehicleBrandRow[]> {
  const rows = await basePrisma.vehicleBrand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { models: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    active: r.active,
    modelsCount: r._count.models,
  }));
}

export type VehicleModelRow = {
  id: string;
  name: string;
  active: boolean;
  brandId: string;
  brandName: string;
};

export async function listVehicleModels(): Promise<VehicleModelRow[]> {
  const rows = await basePrisma.vehicleModel.findMany({
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    include: { brand: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    active: r.active,
    brandId: r.brand.id,
    brandName: r.brand.name,
  }));
}

export type VehicleTypeRow = {
  id: string;
  name: string;
  active: boolean;
};

export async function listVehicleTypes(): Promise<VehicleTypeRow[]> {
  const rows = await basePrisma.vehicleType.findMany({
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, active: r.active }));
}

export async function getGlobalProduct(id: string) {
  const product = await basePrisma.globalInsuranceProduct.findUnique({
    where: { id },
    include: {
      branchType: true,
      globalCompany: true,
      coverages: { orderBy: { order: "asc" } },
    },
  });
  return product;
}
