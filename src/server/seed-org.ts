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

/**
 * Siembra el catálogo inicial de una corredora nueva. Idempotente: no hace nada
 * si la organización ya tiene compañías cargadas.
 */
export async function seedOrganizationCatalog(
  db: Db,
  organizationId: string,
): Promise<void> {
  const existing = await db.insuranceCompany.count();
  if (existing > 0) return;

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
