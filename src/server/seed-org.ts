import "server-only";
import type { Db } from "@/server/db";

/** Compañías aseguradoras chilenas frecuentes (catálogo inicial editable). */
const DEFAULT_COMPANIES = [
  "HDI Seguros",
  "Consorcio",
  "BCI Seguros",
  "Mapfre",
  "Chilena Consolidada",
  "SURA",
  "Liberty Seguros",
  "Zurich",
  "Renta Nacional",
  "Penta Vida",
];

/** Ramos de seguro frecuentes en Chile. */
const DEFAULT_LINES: { name: string; code: string; category: string }[] = [
  { name: "Vehículos", code: "AUTO", category: "Generales" },
  { name: "Incendio y Hogar", code: "HOGAR", category: "Generales" },
  { name: "Responsabilidad Civil", code: "RC", category: "Generales" },
  { name: "Transporte", code: "TRANS", category: "Generales" },
  { name: "Ingeniería", code: "ING", category: "Generales" },
  { name: "Garantía", code: "GAR", category: "Generales" },
  { name: "Vida", code: "VIDA", category: "Vida" },
  { name: "Salud", code: "SALUD", category: "Vida" },
  { name: "Accidentes Personales", code: "AP", category: "Vida" },
  { name: "Crédito", code: "CRED", category: "Generales" },
];

/** Motivos de devolución de propuesta frecuentes. */
const DEFAULT_RETURN_REASONS = [
  "Documentación incompleta",
  "Datos del asegurado erróneos",
  "Error en coberturas o deducibles",
  "Prima fuera de política de la compañía",
  "Falta firma o aceptación del cliente",
  "Compañía solicita inspección",
];

const LIFE_COMPANIES = new Set(["Penta Vida", "Chilena Consolidada"]);

const STARTER_PRODUCTS: {
  branch: string;
  name: string;
  affect: number;
  exempt: number;
  renewable: boolean;
  life: boolean;
}[] = [
  { branch: "Vehículos Motorizados", name: "Daños propios", affect: 12, exempt: 0, renewable: true, life: false },
  { branch: "SOAP", name: "SOAP", affect: 5, exempt: 0, renewable: false, life: false },
  { branch: "Incendio", name: "Hogar", affect: 15, exempt: 0, renewable: true, life: false },
  { branch: "Responsabilidad Civil", name: "RC general", affect: 15, exempt: 0, renewable: true, life: false },
  { branch: "Vida y Salud", name: "Vida temporal", affect: 0, exempt: 20, renewable: true, life: true },
];

/**
 * Siembra el catálogo inicial de una corredora nueva. Las compañías se crean
 * una vez. Los productos de partida se completan aunque la corredora ya exista.
 */
export async function seedOrganizationCatalog(
  db: Db,
  organizationId: string,
): Promise<void> {
  const existing = await db.insuranceCompany.count();
  if (existing === 0) {
    await db.insuranceCompany.createMany({
      data: DEFAULT_COMPANIES.map((name) => ({ organizationId, name })),
    });
    await db.insuranceLine.createMany({
      data: DEFAULT_LINES.map((line) => ({ organizationId, ...line })),
    });
    await db.proposalReturnReason.createMany({
      data: DEFAULT_RETURN_REASONS.map((name) => ({ organizationId, name })),
    });
  }
  await ensureStarterProducts(db, organizationId);
  await ensureStarterCoverages(db, organizationId);
}

async function ensureStarterProducts(db: Db, organizationId: string): Promise<void> {
  const productCount = await db.insuranceProduct.count();
  if (productCount > 0) return;
  const [companies, branches] = await Promise.all([
    db.insuranceCompany.findMany({ select: { id: true, name: true } }),
    db.branchType.findMany({ select: { id: true, name: true } }),
  ]);
  const branchId = new Map(branches.map((branch) => [branch.name, branch.id]));
  for (const company of companies) {
    const life = LIFE_COMPANIES.has(company.name);
    for (const template of STARTER_PRODUCTS) {
      if (template.life !== life) continue;
      const branchTypeId = branchId.get(template.branch);
      if (!branchTypeId) continue;
      const found = await db.insuranceProduct.findFirst({
        where: {
          insuranceCompanyId: company.id,
          branchTypeId,
          name: template.name,
        },
        select: { id: true },
      });
      if (found) continue;
      await db.insuranceProduct.create({
        data: {
          organizationId,
          insuranceCompanyId: company.id,
          branchTypeId,
          name: template.name,
          commissionAffectPct: template.affect,
          commissionExemptPct: template.exempt,
          isRenewable: template.renewable,
          active: true,
        },
      });
    }
  }
}

const STARTER_COVERAGES: Record<string, { name: string; affectedByIva: boolean }[]> = {
  "Daños propios": [
    { name: "Daño propio", affectedByIva: true },
    { name: "Responsabilidad civil", affectedByIva: true },
  ],
  SOAP: [{ name: "SOAP", affectedByIva: true }],
  Hogar: [
    { name: "Incendio edificio", affectedByIva: true },
    { name: "Contenido", affectedByIva: true },
  ],
  "RC general": [{ name: "Responsabilidad civil", affectedByIva: true }],
  "Vida temporal": [{ name: "Fallecimiento", affectedByIva: false }],
};

async function ensureStarterCoverages(db: Db, organizationId: string): Promise<void> {
  const products = await db.insuranceProduct.findMany({
    where: { name: { in: Object.keys(STARTER_COVERAGES) } },
    select: { id: true, name: true, _count: { select: { coverages: true } } },
  });
  for (const product of products) {
    if (product._count.coverages > 0) continue;
    const rows = STARTER_COVERAGES[product.name] ?? [];
    for (const [order, row] of rows.entries()) {
      await db.tenantProductCoverage.create({
        data: {
          organizationId,
          productId: product.id,
          order,
          name: row.name,
          type: "COBERTURA",
          affectedByIva: row.affectedByIva,
          sumsToTotal: true,
        },
      });
    }
  }
}
