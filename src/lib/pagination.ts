/**
 * Cursor pagination utilities. Cursor = id del último item de la página.
 * Pensado para listados ordenados por createdAt desc + id como tiebreak.
 */

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export type PageParams = {
  cursor: string | null;
  direction: "next" | "prev";
  pageSize: number;
};

export type Paginated<T> = {
  rows: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  pageSize: number;
  total?: number;
};

/** Lee searchParams (?cursor, ?dir, ?size) y normaliza a PageParams. */
export function parsePageParams(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  defaults: { pageSize?: number } = {},
): PageParams {
  const sp = searchParams ?? {};
  const cursor = typeof sp.cursor === "string" && sp.cursor.length > 0
    ? sp.cursor
    : null;
  const direction = sp.dir === "prev" ? "prev" : "next";
  const rawSize = typeof sp.size === "string" ? Number(sp.size) : Number.NaN;
  const pageSize = Number.isFinite(rawSize) && rawSize > 0
    ? Math.min(Math.trunc(rawSize), MAX_PAGE_SIZE)
    : defaults.pageSize ?? DEFAULT_PAGE_SIZE;
  return { cursor, direction, pageSize };
}

/**
 * Devuelve los args (take/skip/cursor) para pasar a findMany.
 * Tira pageSize+1 para detectar si hay siguiente.
 */
export function cursorArgs(params: PageParams) {
  const take = params.direction === "prev"
    ? -(params.pageSize + 1)
    : params.pageSize + 1;
  return {
    take,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  };
}

/**
 * Toma los rows crudos de findMany (con un extra) y devuelve Paginated.
 * Requiere que cada row tenga `id`.
 */
export function buildPaginated<T extends { id: string }>(
  rows: T[],
  params: PageParams,
  total?: number,
): Paginated<T> {
  const hasExtra = rows.length > params.pageSize;
  const trimmed = hasExtra ? rows.slice(0, params.pageSize) : rows;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];

  // Si vamos hacia "prev", Prisma devuelve invertido cuando take es negativo.
  // Mantenemos el orden original que dio findMany.
  const nextCursor = hasExtra && last ? last.id : null;
  const prevCursor = params.cursor && first ? first.id : null;

  return {
    rows: trimmed,
    nextCursor,
    prevCursor,
    pageSize: params.pageSize,
    total,
  };
}

/** Genera el href para prev/next conservando otros searchParams. */
export function pageHref(
  baseHref: string,
  currentParams: Record<string, string | string[] | undefined> | undefined,
  next: { cursor: string | null; direction: "next" | "prev" } | null,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(currentParams ?? {})) {
    if (k === "cursor" || k === "dir") continue;
    if (typeof v === "string" && v.length > 0) sp.set(k, v);
  }
  if (next?.cursor) {
    sp.set("cursor", next.cursor);
    sp.set("dir", next.direction);
  }
  const qs = sp.toString();
  return qs ? `${baseHref}?${qs}` : baseHref;
}
