/**
 * Importación única de la cartera de producción legacy (Brokeris/Brider) → Policy + PolicyItem.
 *
 * Uso:
 *   pnpm exec tsx scripts/import-produccion.ts <acumulativo.csv> <por_items.csv> <organizationId> [--dry-run]
 *
 * Reglas (acordadas):
 * - 1 Policy por Num_Poliza (upsert por policyNumber). externalId = ID_Poliza original.
 * - Estado agregado por Num_Poliza: Anulada > Cancelada > Vencida(fin<hoy) > Vigente.
 * - Ítems: solo originales (Num_Endoso 0/vacío) como PolicyItem. Endosos NO se materializan.
 * - Compañías: alias sucios → catálogo del tenant; faltantes se CREAN (custom). FK suelta.
 * - Ramos: best-effort a BranchType por palabra clave; null si no calza.
 * - Comisión (% y monto) preservada. Plan de pago fuera de esta v1.
 */
import { readFileSync } from "node:fs";
import { PrismaClient, Prisma } from "@prisma/client";

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

const clean = (v?: string): string | null => {
  if (!v) return null;
  const t = v.trim();
  return t === "" || t === "-" ? null : t;
};
// es-CL: punto = miles, coma = decimal. "40.763,26" -> 40763.26 ; "122,55" -> 122.55
function parseDec(v?: string): Prisma.Decimal | null {
  const t = clean(v);
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : new Prisma.Decimal(n);
}
function parseDate(v?: string): Date | null {
  const t = clean(v);
  if (!t) return null;
  const m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [, d, mo, y, hh = "0", mm = "0", ss = "0"] = m;
  const dt = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss));
  return isNaN(dt.getTime()) ? null : dt;
}
// RUT contratante viene concatenado cuerpo+dv sin guion
function normRut(v?: string): string | null {
  const t = clean(v);
  if (!t) return null;
  const c = t.replace(/[.\-\s]/g, "").toUpperCase();
  return c.length >= 2 ? `${c.slice(0, -1)}-${c.slice(-1)}` : c;
}
function mapCurrency(v?: string): string {
  const t = (clean(v) ?? "").toUpperCase();
  if (t.includes("EUR")) return "EUR";
  if (t.includes("DÓLAR") || t.includes("DOLAR") || t === "UD" || t.includes("US")) return "USD";
  return "UF";
}

// Compañía: palabra clave → nombre en tenant. Si no calza, se crea custom con el nombre dado.
const COMPANY_KEYWORDS: [RegExp, string][] = [
  [/FID/, "FID Seguros"], [/LIBERTY/, "Liberty Seguros"], [/HDI/, "HDI Seguros"],
  [/ZURICH/, "Zurich"], [/MAPFRE/, "Mapfre"], [/RENTA NACIONAL/, "Renta Nacional"],
  [/SURA/, "SURA"], [/CHILENA CONSOLIDADA/, "Chilena Consolidada"], [/CONSORCIO/, "Consorcio"],
  [/BCI/, "BCI Seguros"], [/PENTA/, "Penta Vida"],
];
function canonicalCompanyName(raw: string): string {
  const up = raw.toUpperCase();
  for (const [re, name] of COMPANY_KEYWORDS) if (re.test(up)) return name;
  // faltante: limpiar sufijos y title-case
  return raw.replace(/\b(S\.?A\.?|SPA|LTDA\.?|SEGUROS|GENERALES)\b/gi, "").replace(/\s+/g, " ").trim()
    .toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || raw.trim();
}

// Ramo: palabra clave → nombre de BranchType. null si no calza con confianza.
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
  return null; // Misceláneos y otros fuera del catálogo legacy → sin mapeo
}

const POLICY_ESTADOS = new Set(["Póliza", "Cancelada", "Anulada"]); // descarta En Elaboración / Enviada a Cía

async function main() {
  const [acumPath, itemsPath, orgId, ...flags] = process.argv.slice(2);
  const dryRun = flags.includes("--dry-run");
  if (!acumPath || !itemsPath || !orgId) {
    console.error("Uso: tsx scripts/import-produccion.ts <acumulativo.csv> <por_items.csv> <orgId> [--dry-run]");
    process.exit(1);
  }
  const acum = parseCsv(readFileSync(acumPath, "utf8"));
  const items = parseCsv(readFileSync(itemsPath, "utf8"));
  console.log(`Acumulativo: ${acum.length} | Items: ${items.length}  ${dryRun ? "(DRY-RUN)" : ""}`);

  // --- Catálogos ---
  const clients = await prisma.client.findMany({ where: { organizationId: orgId }, select: { id: true, rut: true } });
  const clientByRut = new Map(clients.map((c) => [c.rut, c.id]));
  // Fallback por cuerpo (sin DV) para typos de dígito verificador en el legacy.
  // Solo se usa si el cuerpo identifica a un único cliente.
  const bodyToIds = new Map<string, Set<string>>();
  for (const c of clients) {
    const body = c.rut.split("-")[0];
    if (!bodyToIds.has(body)) bodyToIds.set(body, new Set());
    bodyToIds.get(body)!.add(c.id);
  }
  const clientByBody = new Map<string, string>();
  for (const [body, ids] of bodyToIds) if (ids.size === 1) clientByBody.set(body, [...ids][0]);

  const companies = await prisma.insuranceCompany.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } });
  const companyByName = new Map(companies.map((c) => [c.name.toUpperCase(), c.id]));
  async function resolveCompany(raw: string | null): Promise<string | null> {
    if (!raw) return null;
    const name = canonicalCompanyName(raw);
    const key = name.toUpperCase();
    if (companyByName.has(key)) return companyByName.get(key)!;
    if (dryRun) { companyByName.set(key, "(dry)"); return "(dry)"; }
    const created = await prisma.insuranceCompany.create({ data: { organizationId: orgId, name } });
    companyByName.set(key, created.id);
    return created.id;
  }

  const branches = await prisma.branchType.findMany({ select: { id: true, name: true } });
  const branchByName = new Map(branches.map((b) => [b.name.toUpperCase(), b.id]));
  const resolveBranch = (raw: string | null): string | null => {
    if (!raw) return null;
    const name = canonicalBranchName(raw);
    return name ? branchByName.get(name.toUpperCase()) ?? null : null;
  };

  // --- Estado agregado por Num_Poliza (sobre ambos archivos) ---
  const estadosByNum = new Map<string, Set<string>>();
  for (const r of [...acum, ...items]) {
    const num = clean(r.Num_Poliza);
    if (!num) continue;
    if (!estadosByNum.has(num)) estadosByNum.set(num, new Set());
    estadosByNum.get(num)!.add(r.Estado);
  }

  // --- Ítems originales agrupados por Num_Poliza ---
  const itemsByNum = new Map<string, Record<string, string>[]>();
  let endosoItemsSkipped = 0;
  for (const r of items) {
    const num = clean(r.Num_Poliza);
    if (!num) continue;
    if (clean(r.Num_Endoso) && r.Num_Endoso.trim() !== "0") { endosoItemsSkipped++; continue; }
    if (!itemsByNum.has(num)) itemsByNum.set(num, []);
    itemsByNum.get(num)!.push(r);
  }

  // --- Carátula original por Num_Poliza (Num_Endoso vacío/0; si varias, la más antigua) ---
  const caratulaByNum = new Map<string, Record<string, string>>();
  for (const r of acum) {
    const num = clean(r.Num_Poliza);
    if (!num || !POLICY_ESTADOS.has(r.Estado)) continue;
    const isOriginal = !clean(r.Num_Endoso) || r.Num_Endoso.trim() === "0";
    const prev = caratulaByNum.get(num);
    if (!prev) { if (isOriginal || !caratulaByNum.has(num)) caratulaByNum.set(num, r); }
    else {
      const prevOrig = !clean(prev.Num_Endoso) || prev.Num_Endoso.trim() === "0";
      if (isOriginal && !prevOrig) caratulaByNum.set(num, r);
    }
  }

  const today = new Date();
  function aggStatus(num: string, endDate: Date | null): "VIGENTE" | "VENCIDA" | "CANCELADA" | "ANULADA" {
    const set = estadosByNum.get(num) ?? new Set();
    if (set.has("Anulada")) return "ANULADA";
    if (set.has("Cancelada")) return "CANCELADA";
    if (endDate && endDate < today) return "VENCIDA";
    return "VIGENTE";
  }

  const report = {
    created: 0, updated: 0, items: 0,
    skippedNoClient: [] as string[], skippedNoNumber: 0,
    companiesCreated: 0, unmappedRamos: new Map<string, number>(),
    statusCounts: {} as Record<string, number>, errors: [] as string[],
  };
  const companiesBefore = companies.length;

  for (const [num, cara] of caratulaByNum) {
    const rut = normRut(cara.Rut_Contratante);
    const clientId = rut ? (clientByRut.get(rut) ?? clientByBody.get(rut.split("-")[0])) : undefined;
    if (!clientId) { report.skippedNoClient.push(`${num} (${cara.Contratante})`); continue; }

    const ramoRaw = clean(cara.Ramo);
    const branchId = resolveBranch(ramoRaw);
    if (ramoRaw && !branchId) report.unmappedRamos.set(ramoRaw, (report.unmappedRamos.get(ramoRaw) ?? 0) + 1);
    const companyId = await resolveCompany(clean(cara.Compania));

    const endDate = parseDate(cara.Fin_Vigencia);
    const status = aggStatus(num, endDate);
    report.statusCounts[status] = (report.statusCounts[status] ?? 0) + 1;

    const data = {
      organizationId: orgId,
      clientId,
      policyNumber: num,
      externalId: clean(cara.ID_Poliza),
      companyId,
      branchId,
      status: status as any,
      currency: mapCurrency(cara.Nombre_Moneda),
      premiumNet: parseDec(cara.Prima_Neta),
      commissionPercent: parseDec(cara.Porc_Comision),
      commissionAmount: parseDec(cara.Monto_Comision),
      startDate: parseDate(cara.Inicio_Vigencia),
      endDate,
      createdAt: parseDate(cara.Fecha_Creacion) ?? undefined,
    };

    if (dryRun) { report.created++; report.items += (itemsByNum.get(num)?.length ?? 0); continue; }

    try {
      const existing = await prisma.policy.findFirst({ where: { organizationId: orgId, policyNumber: num }, select: { id: true } });
      let policyId: string;
      if (existing) { await prisma.policy.update({ where: { id: existing.id }, data }); policyId = existing.id; report.updated++; }
      else { const c = await prisma.policy.create({ data }); policyId = c.id; report.created++; }

      // ítems idempotentes: borrar y recrear
      await prisma.policyItem.deleteMany({ where: { policyId } });
      const its = itemsByNum.get(num) ?? [];
      if (its.length) {
        await prisma.policyItem.createMany({
          data: its.map((it) => {
            const veh = [clean(it.Nombre_Marca), clean(it.Modelo), clean(it.Veh_Ano), clean(it.Veh_Patente) ? `Patente ${it.Veh_Patente}` : null].filter(Boolean).join(" ");
            const desc = veh || clean(it.Materia) || clean(it.Descripcion) || clean(it.Riesgo_Asegurado) || clean(it.Identifica) || `Ítem ${it.Num_Item || ""}`.trim();
            return {
              organizationId: orgId, policyId,
              description: desc.slice(0, 500),
              insuredAmount: parseDec(it.Monto_Asegurado),
              currency: mapCurrency(it.Moneda),
            };
          }),
        });
        report.items += its.length;
      }
    } catch (e) {
      report.errors.push(`${num}: ${String((e as Error).message).slice(0, 160)}`);
    }
  }

  report.companiesCreated = companyByName.size - companiesBefore;

  console.log("\n========== REPORTE PRODUCCIÓN ==========");
  console.log("Pólizas creadas:    ", report.created);
  console.log("Pólizas actualizadas:", report.updated);
  console.log("PolicyItems:        ", report.items);
  console.log("Ítems de endoso omitidos:", endosoItemsSkipped);
  console.log("Estados:            ", report.statusCounts);
  console.log("Compañías creadas:  ", report.companiesCreated);
  console.log("Saltadas (sin cliente):", report.skippedNoClient.length);
  for (const s of report.skippedNoClient.slice(0, 20)) console.log("   ", s);
  console.log("Ramos sin mapear:");
  for (const [r, n] of report.unmappedRamos) console.log(`   ${n}x  ${r}`);
  console.log("Errores:            ", report.errors.length);
  for (const e of report.errors.slice(0, 20)) console.log("   ", e);
  console.log("========================================");

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
