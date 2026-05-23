/**
 * Utilidades para el RUT chileno (Rol Único Tributario).
 * El RUT se compone de un cuerpo numérico y un dígito verificador (módulo 11).
 */

/** Quita puntos, guiones y espacios; deja el dígito verificador en mayúscula. */
export function cleanRut(rut: string): string {
  return rut.replace(/[.\-\s]/g, "").toUpperCase();
}

/** Calcula el dígito verificador para un cuerpo numérico de RUT. */
export function computeDv(body: string): string {
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return "0";
  if (remainder === 10) return "K";
  return String(remainder);
}

/** Valida un RUT completo (cuerpo + dígito verificador). */
export function isValidRut(rut: string): boolean {
  const clean = cleanRut(rut);
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  if (body.length < 7 || body.length > 9) return false;
  return computeDv(body) === dv;
}

/** Formatea un RUT con puntos y guion: 12.345.678-9 */
export function formatRut(rut: string): string {
  const clean = cleanRut(rut);
  if (clean.length < 2) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots}-${dv}`;
}

/** Normaliza un RUT a su forma canónica para almacenar (sin puntos, con guion). */
export function normalizeRut(rut: string): string {
  const clean = cleanRut(rut);
  if (clean.length < 2) return clean;
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}
