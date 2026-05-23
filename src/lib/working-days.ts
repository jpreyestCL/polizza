/**
 * Días hábiles en Chile: excluye sábados, domingos y feriados.
 * Los feriados se entregan como un Set de claves "AAAA-MM-DD" (UTC).
 */

/** Clave de día en UTC: "AAAA-MM-DD". */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function isBusinessDay(date: Date, holidays: Set<string>): boolean {
  return !isWeekend(date) && !holidays.has(dayKey(date));
}

/**
 * Días hábiles transcurridos desde `from` (exclusivo) hasta `to` (inclusivo).
 * Devuelve 0 si `to` no es posterior a `from`.
 */
export function businessDaysBetween(
  from: Date,
  to: Date,
  holidays: Set<string>,
): number {
  if (to.getTime() <= from.getTime()) return 0;
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const end = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()),
  );
  let count = 0;
  while (cursor.getTime() < end.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(cursor, holidays)) count += 1;
  }
  return count;
}

/** Suma `days` días hábiles a una fecha. */
export function addBusinessDays(
  from: Date,
  days: number,
  holidays: Set<string>,
): Date {
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  let added = 0;
  while (added < days) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(cursor, holidays)) added += 1;
  }
  return cursor;
}
