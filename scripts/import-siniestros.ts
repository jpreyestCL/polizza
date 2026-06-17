/**
 * Importación única de siniestros legacy (Brokeris/Brider) → tabla Claim.
 *
 * Uso: pnpm exec tsx scripts/import-siniestros.ts <Siniestros.csv> <organizationId> [--dry-run]
 *
 * - Idempotente: upsert por (organizationId, folderNumber = Correlativo).
 * - Cliente por RUT contratante (fallback por cuerpo). Póliza por Num_Poliza (opcional).
 * - Ramo → BranchType (mismo criterio que producción).
 * - Datos sin campo propio (Deducible, Patente, Monto_Provisión, Subestado, Tipo_Pérdida…)
 *   se guardan en Claim.data (JSON).
 */
import { readFileSync } from "node:fs";
import { PrismaClient, Prisma } from "@prisma/client";

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

const clean = (v?: string): string | null => {
  if (!v) return null;
  const t = v.trim();
  return t === "" || t === "-" ? null : t;
};
function parseDec(v?: string): Prisma.Decimal | null {
  const t = clean(v);
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : new Prisma.Decimal(n);
}
function decNum(v?: string): number | null {
  const d = parseDec(v);
  return d ? Number(d) : null;
}
// Acepta DD-MM-YYYY o DD/MM/YYYY, con hora opcional. Sentinela 1900 → null.
function parseDate(v?: string): Date | null {
  const t = clean(v);
  if (!t) return null;
  const m = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [, d, mo, y, hh = "0", mm = "0", ss = "0"] = m;
  if (+y < 1950) return null;
  const dt = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss));
  return isNaN(dt.getTime()) ? null : dt;
}
function normRut(v?: string): string | null {
  const t = clean(v);
  if (!t) return null;
  const c = t.replace(/[.\-\s]/g, "").toUpperCase();
  return c.length >= 2 ? `${c.slice(0, -1)}-${c.slice(-1)}` : c;
}
function mapCurrency(v?: string): string {
  const t = (clean(v) ?? "").toUpperCase();
  if (t.includes("EUR")) return "EUR";
  if (t.includes("DÓLAR") || t.includes("DOLAR") || t.includes("US")) return "USD";
  return "UF";
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
function mapStatus(estado: string): "REPORTADO" | "INGRESADO_COMPANIA" | "EN_EVALUACION" | "APROBADO" | "RECHAZADO" | "PAGADO" | "CERRADO" {
  const e = estado.toLowerCase();
  if (e.includes("cerrado")) return "CERRADO";
  if (e.includes("liquidación") || e.includes("liquidacion")) return "EN_EVALUACION";
  if (e.includes("pago")) return "APROBADO";
  return "REPORTADO";
}

async function main() {
  const [csvPath, orgId, ...flags] = process.argv.slice(2);
  const dryRun = flags.includes("--dry-run");
  if (!csvPath || !orgId) { console.error("Uso: tsx scripts/import-siniestros.ts <csv> <orgId> [--dry-run]"); process.exit(1); }

  const records = parseCsv(readFileSync(csvPath, "utf8"));
  console.log(`Siniestros en CSV: ${records.length}  ${dryRun ? "(DRY-RUN)" : ""}`);

  const clients = await prisma.client.findMany({ where: { organizationId: orgId }, select: { id: true, rut: true } });
  const clientByRut = new Map(clients.map((c) => [c.rut, c.id]));
  const bodyIds = new Map<string, Set<string>>();
  for (const c of clients) { const b = c.rut.split("-")[0]; (bodyIds.get(b) ?? bodyIds.set(b, new Set()).get(b)!).add(c.id); }
  const clientByBody = new Map<string, string>();
  for (const [b, ids] of bodyIds) if (ids.size === 1) clientByBody.set(b, [...ids][0]);

  const policies = await prisma.policy.findMany({ where: { organizationId: orgId }, select: { id: true, policyNumber: true } });
  const policyByNumber = new Map(policies.map((p) => [p.policyNumber, p.id]));

  const branches = await prisma.branchType.findMany({ select: { id: true, name: true } });
  const branchByName = new Map(branches.map((b) => [b.name.toUpperCase(), b.id]));
  const resolveBranch = (raw: string | null): string | null => {
    if (!raw) return null;
    const n = canonicalBranchName(raw);
    return n ? branchByName.get(n.toUpperCase()) ?? null : null;
  };

  const report = { created: 0, updated: 0, noPolicy: 0, statusCounts: {} as Record<string, number>, skippedNoClient: [] as string[], errors: [] as string[] };

  for (const r of records) {
    const rut = normRut(r.Rut_Contratante);
    const clientId = rut ? (clientByRut.get(rut) ?? clientByBody.get(rut.split("-")[0])) : undefined;
    if (!clientId) { report.skippedNoClient.push(`${r.ID_Denuncio} (${r.Razon_Social_Contratante})`); continue; }

    const policyId = clean(r.Num_Poliza) ? policyByNumber.get(r.Num_Poliza.trim()) ?? null : null;
    if (!policyId) report.noPolicy++;

    const folderNumber = parseInt(r.Correlativo, 10);
    const status = mapStatus(r.Estado);
    report.statusCounts[status] = (report.statusCounts[status] ?? 0) + 1;
    const reporterPhone = clean(r.Telefono_Denunciante) ?? clean(r.Celular_Denunciante);
    const tipoPerdida = (clean(r.Tipo_Perdida) ?? "").toLowerCase();
    const lossType = tipoPerdida.includes("total") ? "TOTAL" : tipoPerdida.includes("parcial") ? "PARCIAL" : null;

    const data: Record<string, unknown> = {};
    const put = (k: string, v: unknown) => { if (v !== null && v !== undefined && v !== "") data[k] = v; };
    put("idDenuncio", clean(r.ID_Denuncio));
    put("deducible", decNum(r.Deducible));
    put("patente", clean(r.Patente));
    put("montoProvision", decNum(r.Monto_Provision));
    put("subestado", clean(r.Subestado));
    put("tipoPerdida", clean(r.Tipo_Perdida));
    put("materia", clean(r.Materia));
    put("numItem", clean(r.Num_Item));
    put("rutAsegurado", clean(r.Rut_Asegurado));
    put("nombreAsegurado", clean(r.Razon_Social_Asegurado));
    put("companiaLegacy", clean(r.Compania));
    put("inicioVigencia", clean(r.Inicio_Vigencia));
    put("finVigencia", clean(r.Fin_Vigencia));

    const claimData = {
      organizationId: orgId,
      clientId,
      policyId,
      claimNumber: clean(r.Num_Siniestro) ?? `DEN-${r.ID_Denuncio}`,
      folderNumber,
      companyClaimNumber: clean(r.Num_Denuncio_Cia),
      liquidatorName: clean(r.Liquidador),
      description: (clean(r.Relato_Denuncio) ?? clean(r.Causa) ?? clean(r.Materia) ?? "Siniestro").slice(0, 5000),
      status: status as any,
      currency: mapCurrency(r.Nombre_Moneda),
      estimatedAmount: parseDec(r.Monto_Reclamado),
      settledAmount: parseDec(r.Monto_Liquidado),
      branchTypeId: resolveBranch(clean(r.Nombre_Ramo)),
      entryParty: (clean(r.Entrada_Denuncio)?.toUpperCase() === "COR" ? "CORREDOR" : clean(r.Entrada_Denuncio)?.toUpperCase() === "CIA" ? "COMPANIA" : null) as any,
      entryChannel: (clean(r.Canal) ? "OTRO" : null) as any,
      reportedAt: parseDate(r.Fecha_Denuncio),
      reportedAtBroker: parseDate(r.Fecha_Aviso_Corredora),
      filedAtCompanyAt: parseDate(r.Fecha_Enviado),
      reporterRut: normRut(r.Rut_Denunciante),
      reporterFirstName: clean(r.Nombre_Denunciante),
      reporterLastName: clean(r.Apellido_Denunciante),
      reporterPhone,
      reporterEmail: clean(r.Email_Denunciante),
      occurredAt: parseDate(r.Fecha_Siniestro),
      mainCoverageAffected: clean(r.Cobertura_Principal_Afectada),
      policeReportDate: parseDate(r.Fecha_Parte_Policial),
      policeStation: clean(r.Comisaria),
      policeReportFolio: clean(r.Folio),
      incidentCause: clean(r.Causa),
      incidentAddress: clean(r.Lugar_Hechos),
      incidentCommune: clean(r.Comuna),
      incidentCity: clean(r.Ciudad),
      incidentNarrative: clean(r.Relato_Denuncio),
      lossType: lossType as any,
      data,
      createdAt: parseDate(r.Fecha_Creado) ?? parseDate(r.Fecha_Denuncio) ?? undefined,
    };

    if (dryRun) { report.created++; continue; }
    try {
      const existing = await prisma.claim.findFirst({ where: { organizationId: orgId, folderNumber }, select: { id: true } });
      if (existing) { await prisma.claim.update({ where: { id: existing.id }, data: claimData }); report.updated++; }
      else { await prisma.claim.create({ data: claimData }); report.created++; }
    } catch (e) {
      report.errors.push(`${r.ID_Denuncio} (folder ${folderNumber}): ${String((e as Error).message).slice(0, 160)}`);
    }
  }

  console.log("\n========== REPORTE SINIESTROS ==========");
  console.log("Creados:    ", report.created);
  console.log("Actualizados:", report.updated);
  console.log("Sin póliza vinculada:", report.noPolicy);
  console.log("Estados:    ", report.statusCounts);
  console.log("Saltados (sin cliente):", report.skippedNoClient.length);
  for (const s of report.skippedNoClient.slice(0, 20)) console.log("   ", s);
  console.log("Errores:    ", report.errors.length);
  for (const e of report.errors.slice(0, 20)) console.log("   ", e);
  console.log("========================================");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
