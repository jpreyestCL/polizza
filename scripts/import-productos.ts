/**
 * Crea el catálogo de productos de la corredora a partir de la producción
 * legacy (Brokeris/Brider) y enlaza cada póliza con su producto.
 *
 * Uso:
 *   pnpm exec tsx scripts/import-productos.ts <por_items.csv> <organizationId> [--dry-run]
 *
 * - Un InsuranceProduct por (nombre de producto + compañía). El ramo se toma
 *   del primer registro que lo traiga, con el MISMO criterio que
 *   import-produccion.ts para que calcen entre sí.
 * - Idempotente: si el producto ya existe (mismo nombre + compañía) lo reusa,
 *   y `Policy.productId` se reescribe siempre al mismo valor.
 * - Las pólizas se enlazan por Num_Poliza dentro de la organización. Solo se
 *   usan las filas de carátula (Num_Endoso 0/vacío), igual que la importación
 *   de producción, para no tomar el producto de un endoso posterior.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseCsv(text: string, delimiter = "|"): Record<string, string>[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch === "\r") { /* skip */ }
    else field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  const header = rows.shift()!;
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const COMPANY_KEYWORDS: [RegExp, string][] = [
  [/FID/, "FID Seguros"], [/LIBERTY/, "Liberty Seguros"], [/HDI/, "HDI Seguros"],
  [/ZURICH/, "Zurich"], [/MAPFRE/, "Mapfre"], [/RENTA NACIONAL/, "Renta Nacional"],
  [/SURA/, "SURA"], [/CHILENA CONSOLIDADA/, "Chilena Consolidada"], [/CONSORCIO/, "Consorcio"],
  [/BCI/, "BCI Seguros"], [/PENTA/, "Penta Vida"],
];
function canonicalCompanyName(raw: string): string {
  const up = raw.toUpperCase();
  for (const [re, name] of COMPANY_KEYWORDS) if (re.test(up)) return name;
  return raw.replace(/\b(S\.?A\.?|SPA|LTDA\.?|SEGUROS|GENERALES)\b/gi, "").replace(/\s+/g, " ").trim()
    .toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || raw.trim();
}

function canonicalBranchName(raw: string): string | null {
  const up = raw.toUpperCase();
  if (up.includes("VEH")) return "Vehículos Motorizados";
  if (up.includes("INCENDIO")) return "Incendio";
  if (up.includes("EQUIPO MÓVIL") || up.includes("EQUIPO MOVIL")) return up.includes("GENERAL") ? "Equipo Móvil General" : "Equipo Móvil Individualizado";
  if (up.includes("SALUD") || up.includes("VIDA") || up.includes("DESGRAVAMEN")) return "Vida y Salud";
  if (up.includes("RESPONSABILIDAD")) return "Responsabilidad Civil";
  if (up.includes("GARANT")) return "Garantía";
  if (up.includes("TRANSPORTE")) return "Transporte";
  if (up.includes("NOMINADO")) return up.includes("INNOMINADO") ? "Accidentes Personales Innominados" : "Accidentes Personales Nominados";
  if (up.includes("CONSTRUCCIÓN") || up.includes("CONSTRUCCION") || up.includes("MONTAJE")) return "Todo Riesgo Construcción y Montaje";
  if (up.includes("ROBO")) return "Robo";
  if (up.includes("OBJETOS VALIOSOS")) return "Todo Riesgo Objetos Valiosos";
  if (up.includes("ELECTRÓNICO") || up.includes("ELECTRONICO")) return "Equipo Electrónico";
  if (up.includes("CASCO")) return "Cascos";
  if (up.includes("AGRICOLA") || up.includes("AGRÍCOLA")) return "Agrícola";
  if (up.includes("CATASTRÓFICO") || up.includes("CATASTROFICO")) return "Catastrófico";
  if (up.includes("AVERÍA") || up.includes("AVERIA") || up.includes("MAQUINARIA")) return "Avería Maquinaria";
  if (up.includes("INGENIER")) return "Riesgo de Ingeniería";
  return null;
}

/** Solo la carátula original, no los endosos. */
function isCaratula(numEndoso: string | undefined): boolean {
  const t = (numEndoso ?? "").trim();
  return t === "" || t === "0";
}

async function main() {
  const [itemsPath, orgId, ...flags] = process.argv.slice(2);
  const dryRun = flags.includes("--dry-run");
  if (!itemsPath || !orgId) {
    console.error("Uso: tsx scripts/import-productos.ts <por_items.csv> <organizationId> [--dry-run]");
    process.exit(1);
  }

  const records = parseCsv(readFileSync(itemsPath, "utf8"));
  console.log(`Filas en CSV: ${records.length}${dryRun ? "  (DRY-RUN)" : ""}`);

  const companies = await prisma.insuranceCompany.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
  });
  const companyIdByName = new Map(companies.map((c) => [c.name, c.id]));
  const branchTypes = await prisma.branchType.findMany({ select: { id: true, name: true } });
  const branchIdByName = new Map(branchTypes.map((b) => [b.name, b.id]));

  const existing = await prisma.insuranceProduct.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, insuranceCompanyId: true },
  });
  const productIdByKey = new Map(existing.map((p) => [`${p.name}||${p.insuranceCompanyId}`, p.id]));

  // 1. Descubrir productos (nombre + compañía) y su ramo más frecuente.
  type Discovered = { name: string; companyId: string; branchName: string | null };
  const discovered = new Map<string, Discovered>();
  const policyProduct = new Map<string, string>(); // Num_Poliza -> key de producto
  let sinCompania = 0;
  let sinProducto = 0;

  for (const r of records) {
    const productName = (r.Producto ?? "").trim();
    const numPoliza = (r.Num_Poliza ?? "").trim();
    if (!productName) { sinProducto++; continue; }

    const companyName = canonicalCompanyName((r.Nombre_Compania ?? "").trim());
    const companyId = companyIdByName.get(companyName);
    if (!companyId) { sinCompania++; continue; }

    const key = `${productName}||${companyId}`;
    if (!discovered.has(key)) {
      discovered.set(key, {
        name: productName,
        companyId,
        branchName: canonicalBranchName((r.Ramo ?? "").trim()),
      });
    }
    if (numPoliza && isCaratula(r.Num_Endoso)) policyProduct.set(numPoliza, key);
  }

  console.log(`Productos distintos (nombre+compañía): ${discovered.size}`);
  console.log(`Pólizas con producto en carátula: ${policyProduct.size}`);

  // 2. Crear los que falten.
  let creados = 0;
  for (const [key, d] of discovered) {
    if (productIdByKey.has(key)) continue;
    creados++;
    if (dryRun) { productIdByKey.set(key, `dry-${creados}`); continue; }
    const created = await prisma.insuranceProduct.create({
      data: {
        organizationId: orgId,
        insuranceCompanyId: d.companyId,
        branchTypeId: d.branchName ? (branchIdByName.get(d.branchName) ?? null) : null,
        name: d.name,
        active: true,
      },
      select: { id: true },
    });
    productIdByKey.set(key, created.id);
  }

  // 3. Enlazar las pólizas.
  const policies = await prisma.policy.findMany({
    where: { organizationId: orgId },
    select: { id: true, policyNumber: true, productId: true },
  });
  const policyByNumber = new Map(policies.map((p) => [p.policyNumber, p]));

  let enlazadas = 0, yaEnlazadas = 0, sinMatch = 0;
  for (const [numPoliza, key] of policyProduct) {
    const policy = policyByNumber.get(numPoliza);
    if (!policy) { sinMatch++; continue; }
    const productId = productIdByKey.get(key);
    if (!productId) { sinMatch++; continue; }
    if (policy.productId === productId) { yaEnlazadas++; continue; }
    enlazadas++;
    if (!dryRun) {
      await prisma.policy.update({ where: { id: policy.id }, data: { productId } });
    }
  }

  console.log("\n========== REPORTE PRODUCTOS ==========");
  console.log(`Productos creados:        ${creados}`);
  console.log(`Productos ya existentes:  ${discovered.size - creados}`);
  console.log(`Pólizas enlazadas:        ${enlazadas}`);
  console.log(`Pólizas ya enlazadas:     ${yaEnlazadas}`);
  console.log(`Pólizas sin match en DB:  ${sinMatch}`);
  console.log(`Filas sin producto:       ${sinProducto}`);
  console.log(`Filas sin compañía:       ${sinCompania}`);
  console.log("=======================================");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
