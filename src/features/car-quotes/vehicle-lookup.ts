import "server-only";
import * as cheerio from "cheerio";

/**
 * Datos básicos del vehículo a partir de la patente. Si una fuente externa no
 * los completa todos, el formulario permite ingresarlos manualmente.
 */
export type VehicleData = {
  patente: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  tipoVehiculo: string | null;
  motorizacion: string | null;
};

export type VehicleLookupResult =
  | { ok: true; data: VehicleData; source: string }
  | { ok: false; error: string };

/**
 * Proveedor pluggable de consulta de vehículo por patente. Para reemplazar la
 * fuente, cambiá `defaultProvider` por otro implementador.
 */
export type VehicleLookupProvider = (
  patente: string,
) => Promise<VehicleLookupResult>;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15";

function normalizePlate(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/**
 * Scraping del sitio público patentechile.com. Es la fuente abierta más
 * común; puede romper si el sitio cambia o agrega captcha. Cuando eso pasa,
 * caemos con `ok:false` y el usuario llena los datos a mano.
 */
async function patenteChileProvider(
  patente: string,
): Promise<VehicleLookupResult> {
  const plate = normalizePlate(patente);
  if (!plate) {
    return { ok: false, error: "Patente vacía." };
  }
  try {
    const url = `https://www.patentechile.com/buscar/${encodeURIComponent(plate)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html",
      },
      // Evita cacheo del fetch del runtime.
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Fuente respondió ${res.status}. Ingresa los datos manualmente.`,
      };
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    // El sitio expone una "ficha" con pares <th>etiqueta</th><td>valor</td>.
    // Mapeamos por nombre de etiqueta para no depender de la posición.
    const fields = new Map<string, string>();
    $("th").each((_, el) => {
      const label = $(el).text().trim().toLowerCase();
      const value = $(el).next("td").text().trim();
      if (label && value) fields.set(label, value);
    });

    const pick = (...labels: string[]): string | null => {
      for (const label of labels) {
        const v = fields.get(label);
        if (v) return v;
      }
      return null;
    };

    const marca = pick("marca");
    const modelo = pick("modelo");
    const anioRaw = pick("año", "ano", "año vehículo");
    const tipoVehiculo = pick("tipo", "tipo vehículo", "tipo vehiculo");
    const motorizacion = pick(
      "motor",
      "motorización",
      "motorizacion",
      "combustible",
    );

    const anio = anioRaw ? Number(anioRaw.replace(/\D/g, "")) || null : null;

    const anyData = marca || modelo || anio || tipoVehiculo || motorizacion;
    if (!anyData) {
      return {
        ok: false,
        error: "No se encontraron datos para esa patente.",
      };
    }

    return {
      ok: true,
      source: "patentechile.com",
      data: {
        patente: plate,
        marca,
        modelo,
        anio,
        tipoVehiculo,
        motorizacion,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Error consultando la fuente: ${error.message}`
          : "Error consultando la fuente.",
    };
  }
}

export const defaultProvider: VehicleLookupProvider = patenteChileProvider;

export async function lookupVehicle(
  patente: string,
  provider: VehicleLookupProvider = defaultProvider,
): Promise<VehicleLookupResult> {
  return provider(patente);
}
