/**
 * Importación única de clientes legacy (Brokeris/Brider) → tabla Client.
 *
 * Uso:
 *   pnpm exec tsx scripts/import-clientes.ts <ruta-csv> <organizationId> [--dry-run]
 *
 * - CSV: delimitado por "|", campos entre comillas dobles, encoding UTF-8 (con o sin BOM).
 * - Idempotente: hace upsert por (organizationId, externalId = ID_Cliente).
 * - Crea Holdings reales a partir de la columna "Holding" y vincula a sus miembros.
 * - RUTs inválidos (módulo 11) se IMPORTAN igual y se reportan al final.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------- RUT (réplica de src/lib/rut.ts) ----------
function cleanRut(rut: string): string {
  return rut.replace(/[.\-\s]/g, "").toUpperCase();
}
function computeDv(body: string): string {
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (sum % 11);
  if (r === 11) return "0";
  if (r === 10) return "K";
  return String(r);
}
function isValidRut(rut: string): boolean {
  const c = cleanRut(rut);
  if (c.length < 2) return false;
  const body = c.slice(0, -1);
  const dv = c.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  if (body.length < 7 || body.length > 9) return false;
  return computeDv(body) === dv;
}

// ---------- Parser CSV (| delimitado, comillas dobles) ----------
function parseCsv(text: string, delimiter = "|"): Record<string, string>[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch === "\r") { /* skip */ }
    else field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  const header = rows.shift()!;
  return rows
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, (r[idx] ?? "").trim()])));
}

// ---------- Helpers ----------
function clean(v: string | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t === "" || t === "-" ? null : t;
}
// "25-05-2023 11:45:31" o "08-01-2024" → Date | null
function parseDate(v: string | undefined): Date | null {
  const t = clean(v);
  if (!t) return null;
  const m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [, d, mo, y, hh = "0", mm = "0", ss = "0"] = m;
  const dt = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss));
  return isNaN(dt.getTime()) ? null : dt;
}
function mapType(nombreTipo: string): "PERSONA" | "EMPRESA" {
  return nombreTipo.toLowerCase() === "particular" ? "PERSONA" : "EMPRESA";
}

async function main() {
  const [csvPath, orgId, ...flags] = process.argv.slice(2);
  const dryRun = flags.includes("--dry-run");
  if (!csvPath || !orgId) {
    console.error("Uso: tsx scripts/import-clientes.ts <ruta-csv> <organizationId> [--dry-run]");
    process.exit(1);
  }

  const records = parseCsv(readFileSync(csvPath, "utf8"));
  console.log(`Filas en CSV: ${records.length}  ${dryRun ? "(DRY-RUN)" : ""}`);

  // 1) Crear Holdings reales a partir de la columna "Holding"
  const holdingNames = [...new Set(records.map((r) => clean(r.Holding)).filter(Boolean) as string[])];
  const holdingIdByName = new Map<string, string>();
  for (const name of holdingNames) {
    if (dryRun) { holdingIdByName.set(name, "(dry)"); continue; }
    const existing = await prisma.holding.findFirst({ where: { organizationId: orgId, name } });
    const h = existing ?? (await prisma.holding.create({ data: { organizationId: orgId, name } }));
    holdingIdByName.set(name, h.id);
  }
  console.log(`Holdings: ${holdingNames.length} distintos`);

  const report = {
    created: 0,
    updated: 0,
    invalidRut: [] as { externalId: string; rut: string; name: string }[],
    typeCounts: {} as Record<string, number>,
    statusCounts: { ACTIVO: 0, INACTIVO: 0 },
    errors: [] as { externalId: string; error: string }[],
  };

  for (const r of records) {
    const externalId = clean(r.ID_Cliente);
    const tipo = mapType(r.Nombre_Tipo);
    report.typeCounts[r.Nombre_Tipo] = (report.typeCounts[r.Nombre_Tipo] ?? 0) + 1;

    const body = clean(r.Rut);
    const dv = clean(r.Dv_Rut);
    const rut = body && dv ? `${cleanRut(body)}-${dv.toUpperCase()}` : (body ?? "SIN-RUT");
    if (!isValidRut(rut)) {
      report.invalidRut.push({ externalId: externalId ?? "", rut, name: r.Razon_Social });
    }

    const status = r.Activo === "True" ? "ACTIVO" : "INACTIVO";
    report.statusCounts[status]++;

    const obs = [clean(r.Observaciones), clean(r.Observacion2)].filter(Boolean).join("\n");
    const holdingId = clean(r.Holding) ? holdingIdByName.get(clean(r.Holding)!) ?? null : null;

    const data = {
      organizationId: orgId,
      type: tipo,
      rut,
      name: r.Razon_Social || `${clean(r.Nombre) ?? ""} ${clean(r.Apellido_Pat) ?? ""}`.trim() || rut,
      firstName: clean(r.Nombre),
      lastNamePaterno: clean(r.Apellido_Pat),
      lastNameMaterno: clean(r.Apellido_Mat),
      legalName: tipo === "EMPRESA" ? clean(r.Razon_Social) : null,
      nombreFantasia: clean(r.Nombre_Fantasia),
      esExtranjero: r.Es_Extranjero === "True",
      externalId,
      email: clean(r.Email),
      phone: clean(r.Telefonos),
      celular: clean(r.Celular),
      birthDate: parseDate(r.Fecha_Nacimiento),
      address: clean(r.Direccion),
      commune: clean(r.Comuna),
      city: clean(r.Ciudad),
      giro: clean(r.Giro),
      observaciones: obs || null,
      status: status as "ACTIVO" | "INACTIVO",
      holdingId,
      createdAt: parseDate(r.Creado) ?? undefined,
    };

    if (dryRun) { report.created++; continue; }

    try {
      if (externalId) {
        const existing = await prisma.client.findFirst({
          where: { organizationId: orgId, externalId },
          select: { id: true },
        });
        if (existing) {
          await prisma.client.update({ where: { id: existing.id }, data });
          report.updated++;
        } else {
          await prisma.client.create({ data });
          report.created++;
        }
      } else {
        await prisma.client.create({ data });
        report.created++;
      }
    } catch (e) {
      report.errors.push({ externalId: externalId ?? "", error: String((e as Error).message).slice(0, 200) });
    }
  }

  console.log("\n========== REPORTE ==========");
  console.log("Creados:        ", report.created);
  console.log("Actualizados:   ", report.updated);
  console.log("Tipos (origen): ", report.typeCounts);
  console.log("Status:         ", report.statusCounts);
  console.log("Holdings creados:", holdingNames.length);
  console.log("RUTs inválidos: ", report.invalidRut.length);
  for (const x of report.invalidRut) console.log(`   [${x.externalId}] ${x.rut}  ${x.name}`);
  console.log("Errores:        ", report.errors.length);
  for (const x of report.errors) console.log(`   [${x.externalId}] ${x.error}`);
  console.log("=============================");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
