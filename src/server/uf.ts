import "server-only";
import { basePrisma } from "@/server/db";

const MINDICADOR_BASE = "https://mindicador.cl/api";
const FETCH_THROTTLE_MS = 6 * 60 * 60 * 1000; // 6 horas

/** Evita golpear la API en cada render: throttle en memoria por proceso. */
let lastFetchAttempt = 0;
let lastIndicatorsFetch = 0;

export type UfValue = { value: number; date: Date };
export type IndicatorValues = {
  uf: UfValue | null;
  usdObs: UfValue | null;
  euro: UfValue | null;
};

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toUtcDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Trae la serie reciente de la UF desde mindicador.cl (indicadores económicos
 * de Chile) y la guarda en ExchangeRate. Idempotente vía upsert.
 */
async function fetchAndStoreIndicator(
  endpoint: string,
  currencyCode: string,
): Promise<void> {
  const response = await fetch(`${MINDICADOR_BASE}/${endpoint}`, {
    signal: AbortSignal.timeout(8000),
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`mindicador respondió ${response.status}`);
  }
  const data = (await response.json()) as {
    serie?: { fecha: string; valor: number }[];
  };
  for (const point of data.serie ?? []) {
    const parsed = new Date(point.fecha);
    if (Number.isNaN(parsed.getTime()) || typeof point.valor !== "number") {
      continue;
    }
    const date = toUtcDate(parsed);
    await basePrisma.exchangeRate.upsert({
      where: { currencyCode_date: { currencyCode, date } },
      create: { currencyCode, date, valueClp: point.valor },
      update: { valueClp: point.valor },
    });
  }
}

async function fetchAndStoreUf(): Promise<void> {
  await fetchAndStoreIndicator("uf", "UF");
}

async function fetchAndStoreAll(): Promise<void> {
  await Promise.allSettled([
    fetchAndStoreIndicator("uf", "UF"),
    fetchAndStoreIndicator("dolar", "USD_OBS"),
    fetchAndStoreIndicator("euro", "EUR"),
  ]);
}

/**
 * Valor más reciente de la UF en pesos. Si el dato almacenado no es de hoy,
 * intenta refrescarlo desde la API (con throttle). Ante una falla de red
 * devuelve el último valor conocido, o null si nunca se ha obtenido.
 */
export async function getUfValue(): Promise<UfValue | null> {
  let latest = await basePrisma.exchangeRate.findFirst({
    where: { currencyCode: "UF" },
    orderBy: { date: "desc" },
  });

  const fresh = latest && utcDateKey(latest.date) >= utcDateKey(new Date());
  if (!fresh && Date.now() - lastFetchAttempt > FETCH_THROTTLE_MS) {
    lastFetchAttempt = Date.now();
    try {
      await fetchAndStoreUf();
      latest = await basePrisma.exchangeRate.findFirst({
        where: { currencyCode: "UF" },
        orderBy: { date: "desc" },
      });
    } catch {
      // Sin conexión a la API: se mantiene el último valor almacenado.
    }
  }

  if (!latest) return null;
  return { value: Number(latest.valueClp), date: latest.date };
}

/**
 * Valores más recientes de UF, Dólar Observado y Euro en pesos.
 * Comparte el throttle con la UF y refresca los 3 indicadores juntos.
 */
export async function getIndicatorValues(): Promise<IndicatorValues> {
  const fresh =
    Date.now() - lastIndicatorsFetch < FETCH_THROTTLE_MS;
  if (!fresh) {
    lastIndicatorsFetch = Date.now();
    try {
      await fetchAndStoreAll();
    } catch {
      // Si falla la red, devolvemos los últimos almacenados.
    }
  }
  const [uf, usdObs, euro] = await Promise.all([
    basePrisma.exchangeRate.findFirst({
      where: { currencyCode: "UF" },
      orderBy: { date: "desc" },
    }),
    basePrisma.exchangeRate.findFirst({
      where: { currencyCode: "USD_OBS" },
      orderBy: { date: "desc" },
    }),
    basePrisma.exchangeRate.findFirst({
      where: { currencyCode: "EUR" },
      orderBy: { date: "desc" },
    }),
  ]);
  return {
    uf: uf ? { value: Number(uf.valueClp), date: uf.date } : null,
    usdObs: usdObs ? { value: Number(usdObs.valueClp), date: usdObs.date } : null,
    euro: euro ? { value: Number(euro.valueClp), date: euro.date } : null,
  };
}
