import { PrismaClient } from "@prisma/client";
import { seedGlobals } from "./seed-globals";
import { seedCommunes } from "./seed-communes";
import { seedVehicles } from "./seed-vehicles";

const prisma = new PrismaClient();

const CURRENCIES = [
  { code: "UF", name: "Unidad de Fomento", symbol: "UF" },
  { code: "CLP", name: "Peso chileno", symbol: "$" },
  { code: "USD", name: "Dólar estadounidense", symbol: "US$" },
  { code: "EUR", name: "Euro", symbol: "€" },
];

// Feriados legales de Chile 2026 (referenciales para el cálculo de días hábiles).
const HOLIDAYS_2026: { date: string; name: string }[] = [
  { date: "2026-01-01", name: "Año Nuevo" },
  { date: "2026-04-03", name: "Viernes Santo" },
  { date: "2026-04-04", name: "Sábado Santo" },
  { date: "2026-05-01", name: "Día del Trabajo" },
  { date: "2026-05-21", name: "Día de las Glorias Navales" },
  { date: "2026-06-21", name: "Día de los Pueblos Indígenas" },
  { date: "2026-06-29", name: "San Pedro y San Pablo" },
  { date: "2026-07-16", name: "Día de la Virgen del Carmen" },
  { date: "2026-08-15", name: "Asunción de la Virgen" },
  { date: "2026-09-18", name: "Independencia Nacional" },
  { date: "2026-09-19", name: "Día de las Glorias del Ejército" },
  { date: "2026-10-12", name: "Encuentro de Dos Mundos" },
  { date: "2026-10-31", name: "Día de las Iglesias Evangélicas" },
  { date: "2026-11-01", name: "Día de Todos los Santos" },
  { date: "2026-12-08", name: "Inmaculada Concepción" },
  { date: "2026-12-25", name: "Navidad" },
];

async function main() {
  for (const currency of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: { name: currency.name, symbol: currency.symbol },
      create: currency,
    });
  }

  for (const holiday of HOLIDAYS_2026) {
    const date = new Date(`${holiday.date}T00:00:00Z`);
    await prisma.holiday.upsert({
      where: { date },
      update: { name: holiday.name },
      create: { date, name: holiday.name },
    });
  }

  await seedGlobals(prisma);
  await seedCommunes(prisma);
  await seedVehicles(prisma);

  console.info(
    `Seed global: ${CURRENCIES.length} monedas, ${HOLIDAYS_2026.length} feriados, + catálogos (ramos + compañías globales).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
