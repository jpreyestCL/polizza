/**
 * Importación única de contactos legacy (Brokeris/Brider) → tabla ClientContact.
 *
 * Uso:
 *   pnpm exec tsx scripts/import-contactos.ts <ruta-csv> <organizationId> [--dry-run]
 *
 * - CSV "|"-delimitado, comillas dobles, UTF-8 (con/sin BOM).
 * - Resuelve clientId vía Client.externalId == ID_Cliente. Salta y reporta los huérfanos.
 * - Idempotente: upsert por (organizationId, externalId = ID_Contacto_Cliente).
 * - Marca isPrimary=true al primer contacto de cada cliente (en orden del CSV).
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseCsv(text: string, delimiter = "|"): Record<string, string>[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
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

function clean(v: string | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t === "" || t === "-" ? null : t;
}

async function main() {
  const [csvPath, orgId, ...flags] = process.argv.slice(2);
  const dryRun = flags.includes("--dry-run");
  if (!csvPath || !orgId) {
    console.error("Uso: tsx scripts/import-contactos.ts <ruta-csv> <organizationId> [--dry-run]");
    process.exit(1);
  }

  const records = parseCsv(readFileSync(csvPath, "utf8"));
  console.log(`Filas en CSV: ${records.length}  ${dryRun ? "(DRY-RUN)" : ""}`);

  // Mapa externalId (legacy ID_Cliente) → Client.id
  const clients = await prisma.client.findMany({
    where: { organizationId: orgId, externalId: { not: null } },
    select: { id: true, externalId: true },
  });
  const clientIdByExternal = new Map(clients.map((c) => [c.externalId as string, c.id]));
  console.log(`Clientes con externalId en DB: ${clientIdByExternal.size}`);

  const report = {
    created: 0,
    updated: 0,
    primary: 0,
    orphans: [] as { contactExtId: string; clientExtId: string; name: string }[],
    errors: [] as { contactExtId: string; error: string }[],
  };
  const seenClient = new Set<string>();

  for (const r of records) {
    const contactExtId = clean(r.ID_Contacto_Cliente);
    const clientExtId = clean(r.ID_Cliente);
    const name = `${clean(r.Nombre_Contacto) ?? ""} ${clean(r.Apellido_Contacto) ?? ""}`.trim();

    const clientId = clientExtId ? clientIdByExternal.get(clientExtId) : undefined;
    if (!clientId) {
      report.orphans.push({ contactExtId: contactExtId ?? "", clientExtId: clientExtId ?? "", name });
      continue;
    }

    const isPrimary = !seenClient.has(clientId);
    if (isPrimary) { seenClient.add(clientId); report.primary++; }

    const data = {
      organizationId: orgId,
      clientId,
      name: name || (clean(r.Email_Contacto) ?? "Contacto"),
      role: clean(r.Cargo_Contacto),
      email: clean(r.Email_Contacto),
      phone: clean(r.Telefono_Contacto),
      celular: clean(r.Celular_Contacto),
      notes: clean(r.Obs_Contacto),
      externalId: contactExtId,
      isPrimary,
    };

    if (dryRun) { report.created++; continue; }

    try {
      const existing = contactExtId
        ? await prisma.clientContact.findFirst({
            where: { organizationId: orgId, externalId: contactExtId },
            select: { id: true },
          })
        : null;
      if (existing) {
        await prisma.clientContact.update({ where: { id: existing.id }, data });
        report.updated++;
      } else {
        await prisma.clientContact.create({ data });
        report.created++;
      }
    } catch (e) {
      report.errors.push({ contactExtId: contactExtId ?? "", error: String((e as Error).message).slice(0, 200) });
    }
  }

  console.log("\n========== REPORTE ==========");
  console.log("Creados:           ", report.created);
  console.log("Actualizados:      ", report.updated);
  console.log("Marcados principal:", report.primary);
  console.log("Huérfanos (cliente no existe):", report.orphans.length);
  for (const o of report.orphans) console.log(`   contacto[${o.contactExtId}] → cliente[${o.clientExtId}]  ${o.name}`);
  console.log("Errores:           ", report.errors.length);
  for (const e of report.errors) console.log(`   [${e.contactExtId}] ${e.error}`);
  console.log("=============================");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
