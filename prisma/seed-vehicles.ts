// Seed básico de marcas, modelos y tipos de vehículos.
// Idempotente: usa upsert por nombre (único). Las marcas/modelos listadas
// cubren los más vistos en el mercado chileno; los corredores pueden
// agregar más desde /admin/vehiculos o escribirlos ad-hoc en la ficha.

import type { PrismaClient } from "@prisma/client";

const TYPES = [
  "Automóvil",
  "Camioneta",
  "SUV",
  "Furgón",
  "Camión",
  "Motocicleta",
  "Bus",
  "Tractocamión",
  "Maquinaria",
  "Remolque",
];

const BRAND_MODELS: Record<string, string[]> = {
  Toyota: [
    "Yaris",
    "Corolla",
    "Hilux",
    "RAV4",
    "Land Cruiser",
    "Fortuner",
    "Rush",
    "Camry",
    "C-HR",
    "Hiace",
  ],
  Chevrolet: ["Sail", "Onix", "Tracker", "Captiva", "S10", "D-Max", "Spark", "Cruze"],
  Hyundai: ["Accent", "Elantra", "Tucson", "Santa Fe", "Creta", "Kona", "i10", "i20"],
  Kia: ["Rio", "Cerato", "Sportage", "Sorento", "Picanto", "Stonic", "Soul"],
  Nissan: ["Versa", "Sentra", "Qashqai", "X-Trail", "Navara", "Frontier", "Kicks", "March"],
  Suzuki: ["Swift", "Baleno", "Vitara", "S-Cross", "Jimny", "Celerio", "Alto"],
  Mazda: ["Mazda 2", "Mazda 3", "Mazda 6", "CX-3", "CX-30", "CX-5", "CX-9", "BT-50"],
  Ford: ["Fiesta", "Focus", "EcoSport", "Escape", "Ranger", "Explorer", "Edge", "Territory"],
  Mitsubishi: ["Mirage", "Lancer", "ASX", "Outlander", "L200", "Montero", "Eclipse Cross"],
  Volkswagen: ["Polo", "Gol", "Voyage", "Vento", "T-Cross", "Tiguan", "Amarok", "Saveiro"],
  Peugeot: ["208", "2008", "3008", "5008", "301", "Partner", "Expert"],
  Renault: ["Kwid", "Logan", "Sandero", "Stepway", "Duster", "Captur", "Koleos", "Megane"],
  Citroen: ["C3", "C4 Cactus", "C5 Aircross", "Berlingo", "Jumpy"],
  Fiat: ["Cronos", "Mobi", "Pulse", "Strada", "Toro", "Ducato"],
  BMW: ["Serie 1", "Serie 3", "Serie 5", "X1", "X3", "X5", "X6"],
  "Mercedes-Benz": ["Clase A", "Clase C", "Clase E", "GLA", "GLC", "GLE", "Sprinter"],
  Audi: ["A1", "A3", "A4", "A6", "Q2", "Q3", "Q5", "Q7"],
  Volvo: ["XC40", "XC60", "XC90", "S60", "V60"],
  Honda: ["Fit", "City", "Civic", "HR-V", "CR-V"],
  Subaru: ["Impreza", "Forester", "Outback", "XV", "Legacy"],
  Jeep: ["Renegade", "Compass", "Cherokee", "Grand Cherokee", "Wrangler"],
  "Great Wall": ["Wingle", "Haval H6", "Poer", "Steed"],
  JAC: ["S2", "S3", "S4", "T6", "T8"],
  Changan: ["CS15", "CS35", "CS55", "CS75", "Hunter"],
  MG: ["MG 3", "MG 5", "ZS", "HS"],
  BYD: ["F0", "Yuan", "Han", "Tang", "Song"],
  Maxus: ["T60", "T70", "T90", "G10", "D60"],
  Iveco: ["Daily", "Stralis", "Tector"],
  Scania: ["G410", "G450", "P310", "R450"],
  Yamaha: ["FZ", "MT-03", "MT-07", "YBR", "XTZ"],
  Honda_Moto: [],
  Bajaj: ["Pulsar", "Boxer", "Discover", "Dominar"],
};

export async function seedVehicles(prisma: PrismaClient) {
  for (const name of TYPES) {
    await prisma.vehicleType.upsert({
      where: { name },
      update: { active: true },
      create: { name, active: true },
    });
  }
  for (const [brandName, models] of Object.entries(BRAND_MODELS)) {
    const brand = await prisma.vehicleBrand.upsert({
      where: { name: brandName },
      update: { active: true },
      create: { name: brandName, active: true },
    });
    for (const m of models) {
      await prisma.vehicleModel.upsert({
        where: { brandId_name: { brandId: brand.id, name: m } },
        update: { active: true },
        create: { brandId: brand.id, name: m, active: true },
      });
    }
  }
}
