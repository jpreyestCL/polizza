import "server-only";
import { basePrisma, type Db } from "@/server/db";
import { dayKey } from "@/lib/working-days";

/** Set de feriados ("AAAA-MM-DD") para el cálculo de días hábiles. */
export async function getHolidaySet(): Promise<Set<string>> {
  const holidays = await basePrisma.holiday.findMany({
    select: { date: true },
  });
  return new Set(holidays.map((h) => dayKey(h.date)));
}

export type CatalogItem = { id: string; name: string };

/** Compañías aseguradoras activas de la organización. */
export async function getCompanies(db: Db): Promise<CatalogItem[]> {
  return db.insuranceCompany.findMany({
    where: { status: "ACTIVA" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** Ramos de la organización. */
export async function getLines(db: Db): Promise<CatalogItem[]> {
  return db.insuranceLine.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** Motivos de devolución activos de la organización. */
export async function getReturnReasons(db: Db): Promise<CatalogItem[]> {
  return db.proposalReturnReason.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
