import "server-only";
import { basePrisma } from "@/server/db";

const MINDICADOR_BASE = "https://mindicador.cl/api";
const FETCH_THROTTLE_MS = 6 * 60 * 60 * 1000; // 6 horas

/**
 * Indicadores económicos (UF, Dólar Observado, Euro).
 *
 * Reglas de negocio:
 * 1. Los valores se buscan en mindicador.cl y se guardan en `ExchangeRate`
 *    asociados a su fecha (idempotente vía upsert). Una vez almacenados, las
 *    lecturas SIEMPRE salen de la BD; solo se va a la red cuando falta el dato
 *    más reciente (y con throttle para no golpear la API).
 * 2. Los fines de semana y festivos la fuente puede no publicar dólar/euro (o
 *    devolver 0/valores inválidos). Esos puntos se DESCARTAN al guardar y, al
 *    leer, se filtran los ceros: así se mantiene el último valor válido
 *    (p.ej. el sábado se usa el dólar observado del viernes).
 */

// Throttle en memoria por proceso, por indicador, para evitar reintentos en
// cada render cuando aún no hay un valor nuevo (fin de semana / festivo).
const lastFetchAttempt: Record<string, number> = {};

export type UfValue = { value: number; date: Date };
export type IndicatorValues = {
  uf: UfValue | null;
  usdObs: UfValue | null;
  euro: UfValue | null;
};

type SeriePoint = { fecha: string; valor: number };

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toUtcDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** Un valor de indicador es válido solo si es un número finito y mayor a 0. */
export function isValidRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Normaliza la serie de mindicador descartando puntos inválidos (fecha no
 * parseable o valor ≤ 0 / no numérico). Pura: testeable sin red ni BD.
 */
export function extractValidPoints(
  serie: SeriePoint[] | undefined,
): { date: Date; value: number }[] {
  const out: { date: Date; value: number }[] = [];
  for (const point of serie ?? []) {
    const parsed = new Date(point.fecha);
    if (Number.isNaN(parsed.getTime())) continue;
    if (!isValidRate(point.valor)) continue; // descarta 0 / NaN / negativos
    out.push({ date: toUtcDate(parsed), value: point.valor });
  }
  return out;
}

async function fetchSerie(endpoint: string): Promise<SeriePoint[]> {
  const response = await fetch(`${MINDICADOR_BASE}/${endpoint}`, {
    signal: AbortSignal.timeout(8000),
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`mindicador respondió ${response.status}`);
  }
  const data = (await response.json()) as { serie?: SeriePoint[] };
  return data.serie ?? [];
}

/**
 * Trae la serie reciente de un indicador y guarda solo los puntos válidos.
 * Idempotente vía upsert por (currencyCode, date).
 */
async function fetchAndStoreIndicator(
  endpoint: string,
  currencyCode: string,
): Promise<void> {
  const serie = await fetchSerie(endpoint);
  const points = extractValidPoints(serie);
  for (const { date, value } of points) {
    await basePrisma.exchangeRate.upsert({
      where: { currencyCode_date: { currencyCode, date } },
      create: { currencyCode, date, valueClp: value },
      update: { valueClp: value },
    });
  }
}

const ENDPOINTS: { currencyCode: string; endpoint: string }[] = [
  { currencyCode: "UF", endpoint: "uf" },
  { currencyCode: "USD_OBS", endpoint: "dolar" },
  { currencyCode: "EUR", endpoint: "euro" },
];

/** Último valor VÁLIDO (>0) almacenado de un indicador. */
async function latestStored(currencyCode: string): Promise<UfValue | null> {
  const row = await basePrisma.exchangeRate.findFirst({
    where: { currencyCode, valueClp: { gt: 0 } },
    orderBy: { date: "desc" },
  });
  return row ? { value: Number(row.valueClp), date: row.date } : null;
}

/**
 * ¿Hace falta ir a la red por este indicador? Solo si no tenemos ningún valor
 * o si el último almacenado es anterior a hoy (puede haber un dato nuevo). El
 * throttle evita reintentos seguidos cuando aún no se publica (fin de semana).
 */
async function maybeRefresh(
  currencyCode: string,
  endpoint: string,
): Promise<void> {
  const latest = await latestStored(currencyCode);
  const haveToday = latest && utcDateKey(latest.date) >= utcDateKey(new Date());
  if (haveToday) return; // ya tenemos el valor de hoy: no se vuelve a buscar

  const last = lastFetchAttempt[currencyCode] ?? 0;
  if (Date.now() - last < FETCH_THROTTLE_MS) return;
  lastFetchAttempt[currencyCode] = Date.now();
  try {
    await fetchAndStoreIndicator(endpoint, currencyCode);
  } catch {
    // Sin conexión: se mantiene el último valor válido almacenado.
  }
}

/**
 * Valor más reciente VÁLIDO de la UF en pesos. Si no hay dato de hoy intenta
 * refrescar (con throttle); ante falla de red devuelve el último almacenado.
 */
export async function getUfValue(): Promise<UfValue | null> {
  await maybeRefresh("UF", "uf");
  return latestStored("UF");
}

/**
 * Valores más recientes VÁLIDOS de UF, Dólar Observado y Euro en pesos. Cada
 * indicador se refresca solo si le falta el dato de hoy; el resto sale de la
 * BD. Los ceros/valores inválidos nunca se devuelven (se mantiene el último
 * válido — p.ej. fines de semana y festivos).
 */
export async function getIndicatorValues(): Promise<IndicatorValues> {
  await Promise.allSettled(
    ENDPOINTS.map((e) => maybeRefresh(e.currencyCode, e.endpoint)),
  );
  const [uf, usdObs, euro] = await Promise.all([
    latestStored("UF"),
    latestStored("USD_OBS"),
    latestStored("EUR"),
  ]);
  return { uf, usdObs, euro };
}
