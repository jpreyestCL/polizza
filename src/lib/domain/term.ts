/** Días de calendario entre dos fechas de negocio (columnas Date, medianoche UTC). */

const DAY_MS = 86_400_000;

export function utcDayNumber(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((utcDayNumber(to) - utcDayNumber(from)) / DAY_MS);
}

/**
 * Un año calendario después. El 29 de febrero cae en el 28 de febrero
 * del año siguiente.
 */
/** Suma meses sobre una fecha de negocio (medianoche UTC), sin correr el día. */
export function addUtcMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const firstOfTarget = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      firstOfTarget.getUTCFullYear(),
      firstOfTarget.getUTCMonth(),
      Math.min(day, lastDay),
    ),
  );
}

export function addCalendarYear(date: Date): Date {
  if (date.getUTCMonth() === 1 && date.getUTCDate() === 29) {
    return new Date(Date.UTC(date.getUTCFullYear() + 1, 1, 28));
  }
  return new Date(
    Date.UTC(date.getUTCFullYear() + 1, date.getUTCMonth(), date.getUTCDate()),
  );
}

/** Años calendario exactos (mismo mes y día). Null si el período no es N años justos. */
export function wholeCalendarYears(start: Date, end: Date): number | null {
  const years = end.getUTCFullYear() - start.getUTCFullYear();
  if (years <= 0) return null;
  const anniversary = Date.UTC(
    start.getUTCFullYear() + years,
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  return anniversary === utcDayNumber(end) ? years : null;
}

/**
 * Fracción no devengada de la prima. En un período de N años calendario
 * la base es N × 365, así un 29 de febrero no prorratea la prima anual.
 */
export function unearnedFactor(
  termStart: Date,
  termEnd: Date,
  effective: Date,
): number {
  if (calendarDaysBetween(termStart, effective) <= 0) return 1;
  const remaining = calendarDaysBetween(effective, termEnd);
  if (remaining <= 0) return 0;
  const years = wholeCalendarYears(termStart, termEnd);
  const base =
    years != null ? years * 365 : calendarDaysBetween(termStart, termEnd);
  if (base <= 0) return 0;
  return Math.min(1, remaining / base);
}
