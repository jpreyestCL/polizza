import type { PrismaClient } from "@prisma/client";
import { REGIONS } from "../src/lib/regions-communes";

/**
 * Slug ASCII para construir códigos estables de comuna a partir de su nombre.
 * No es el código INE oficial, pero es determinístico y único cuando se
 * combina con el código de la región.
 */
function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function seedCommunes(prisma: PrismaClient) {
  let count = 0;
  for (const region of REGIONS) {
    for (const name of region.communes) {
      const code = `${region.code}-${slug(name)}`;
      await prisma.commune.upsert({
        where: { code },
        update: { name, region: region.name, city: name },
        create: {
          code,
          name,
          // `city` queda igual al nombre de la comuna como fallback aceptable.
          // Cuando se cuente con la provincia oficial, se puede sobrescribir.
          city: name,
          region: region.name,
        },
      });
      count++;
    }
  }
  console.info(`Seed comunas: ${count} comunas cargadas.`);
}
