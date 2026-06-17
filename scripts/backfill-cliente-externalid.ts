/**
 * Backfill de Client.externalId para clientes que ya existían (creados a mano)
 * y por eso fueron saltados en la importación inicial por choque de RUT.
 *
 * Uso: pnpm exec tsx scripts/backfill-cliente-externalid.ts <Clientes.csv> <organizationId> [--dry-run]
 *
 * Para cada fila del CSV busca el cliente por (org, rut) con externalId NULL y le
 * setea externalId = ID_Cliente. No toca clientes que ya tienen externalId.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseCsv(text: string, delimiter = "|"): Record<string, string>[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += ch; }
    else if (ch === '"') inQ = true;
    else if (ch === delimiter) { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch === "\r") { /* skip */ }
    else field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  const header = rows.shift()!;
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

async function main() {
  const [csvPath, orgId, ...flags] = process.argv.slice(2);
  const dryRun = flags.includes("--dry-run");
  if (!csvPath || !orgId) { console.error("Uso: tsx scripts/backfill-cliente-externalid.ts <csv> <orgId> [--dry-run]"); process.exit(1); }

  const records = parseCsv(readFileSync(csvPath, "utf8"));
  const extIdByRut = new Map<string, string>();
  for (const r of records) {
    const body = r.Rut?.replace(/[.\-\s]/g, "").toUpperCase();
    const dv = r.Dv_Rut?.trim().toUpperCase();
    if (body && dv) extIdByRut.set(`${body}-${dv}`, r.ID_Cliente?.trim());
  }

  const orphans = await prisma.client.findMany({
    where: { organizationId: orgId, externalId: null },
    select: { id: true, rut: true, name: true },
  });

  let updated = 0;
  for (const c of orphans) {
    const ext = extIdByRut.get(c.rut);
    if (!ext) { console.log(`  sin match en CSV: ${c.rut}  ${c.name}`); continue; }
    console.log(`  ${dryRun ? "[dry] " : ""}${c.rut}  ${c.name}  → externalId=${ext}`);
    if (!dryRun) { await prisma.client.update({ where: { id: c.id }, data: { externalId: ext } }); updated++; }
  }
  console.log(`\nClientes sin externalId: ${orphans.length} | actualizados: ${dryRun ? "(dry-run)" : updated}`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
