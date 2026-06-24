/**
 * Backfill quirúrgico del desglose de prima/comisión + snapshot de tipo de
 * cambio sobre pólizas YA importadas. Solo hace UPDATE de los 11 campos nuevos;
 * NO toca ítems, estados, compañías ni clientes.
 *
 * Uso:
 *   pnpm exec tsx scripts/backfill-policy-breakdown.ts <acumulativo.csv> <organizationId> [--dry-run]
 *
 * Matchea por policyNumber (Num_Poliza) dentro de la org. Toma la carátula
 * original (Num_Endoso 0/vacío) con la MISMA lógica que import-produccion.ts,
 * para que los valores calcen con el premiumNet ya cargado. Idempotente.
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
// es-CL: punto = miles, coma = decimal. "40.763,26" -> 40763.26 ; "-72.357" -> -72357
function parseDec(v?: string): Prisma.Decimal | null {
  const t = clean(v);
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : new Prisma.Decimal(n);
}
// SI/NO (es-CL) → boolean; vacío → null.
function parseBool(v?: string): boolean | null {
  const t = clean(v);
  if (!t) return null;
  const u = t.toUpperCase();
  if (["SI", "SÍ", "TRUE", "1"].includes(u)) return true;
  if (["NO", "FALSE", "0"].includes(u)) return false;
  return null;
}

const POLICY_ESTADOS = new Set(["Póliza", "Cancelada", "Anulada"]);

async function main() {
  const [acumPath, orgId, ...flags] = process.argv.slice(2);
  const dryRun = flags.includes("--dry-run");
  if (!acumPath || !orgId) {
    console.error("Uso: tsx scripts/backfill-policy-breakdown.ts <acumulativo.csv> <orgId> [--dry-run]");
    process.exit(1);
  }
  const acum = parseCsv(readFileSync(acumPath, "utf8"));

  // Carátula original por Num_Poliza (idéntico a import-produccion.ts).
  const caratulaByNum = new Map<string, Record<string, string>>();
  for (const r of acum) {
    const num = clean(r.Num_Poliza);
    if (!num || !POLICY_ESTADOS.has(r.Estado)) continue;
    const isOriginal = !clean(r.Num_Endoso) || r.Num_Endoso.trim() === "0";
    const prev = caratulaByNum.get(num);
    if (!prev) caratulaByNum.set(num, r);
    else {
      const prevOrig = !clean(prev.Num_Endoso) || prev.Num_Endoso.trim() === "0";
      if (isOriginal && !prevOrig) caratulaByNum.set(num, r);
    }
  }
  console.log(`Carátulas en CSV: ${caratulaByNum.size}  ${dryRun ? "(DRY-RUN)" : ""}`);

  let updated = 0, notFound = 0, withExempt = 0;
  const missing: string[] = [];
  for (const [num, cara] of caratulaByNum) {
    const data = {
      premiumAffect: parseDec(cara.Prima_Afecta),
      premiumExempt: parseDec(cara.Prima_Exenta),
      commissionCalculated: parseDec(cara.Comision_Calculada),
      commissionAffect: parseDec(cara.Comision_Afecta),
      commissionExempt: parseDec(cara.Comision_Exenta),
      commissionAffectPct: parseDec(cara.Porc_Comision_Afecto),
      commissionExemptPct: parseDec(cara.Porc_Comision_Exento),
      commissionFinalCompany: parseDec(cara.Comision_Final_Cia),
      commissionPaid: parseBool(cara.Comision_Pagada),
      exchangeRate: parseDec(cara.Cambio),
      ufValue: parseDec(cara.Valor_UF),
    };
    if (data.premiumExempt && !data.premiumExempt.isZero()) withExempt++;

    if (dryRun) {
      const exists = await prisma.policy.count({ where: { organizationId: orgId, policyNumber: num } });
      if (exists > 0) updated += exists;
      else { notFound++; if (missing.length < 20) missing.push(num); }
      continue;
    }
    const res = await prisma.policy.updateMany({ where: { organizationId: orgId, policyNumber: num }, data });
    if (res.count > 0) updated += res.count;
    else { notFound++; if (missing.length < 20) missing.push(num); }
  }

  console.log("\n========== BACKFILL DESGLOSE/FX ==========");
  console.log(`Pólizas ${dryRun ? "que matchearían" : "actualizadas"}: ${updated}`);
  console.log(`Con prima exenta != 0:                ${withExempt}`);
  console.log(`Sin match en DB:                      ${notFound}`);
  for (const m of missing) console.log("   sin match:", m);
  console.log("==========================================");

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
