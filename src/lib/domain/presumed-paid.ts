/**
 * Presunción PAC/PAT. Nace apagada: si el parámetro de la corredora es
 * falso, ninguna cuota cambia de estado.
 */

const DAY_MS = 86_400_000;

export type PresumedPaidInput = {
  enabled: boolean;
  method: string | null;
  status: string;
  dueDate: Date;
  today: Date;
  graceDays?: number;
};

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function presumedPaidDecision(
  input: PresumedPaidInput,
): "PRESUNTA" | null {
  if (!input.enabled) return null;
  const method = (input.method ?? "").toUpperCase();
  if (method !== "PAC" && method !== "PAT") return null;
  if (input.status !== "PENDIENTE") return null;
  const grace = input.graceDays ?? 10;
  const duePlusGrace = utcDay(input.dueDate) + grace * DAY_MS;
  if (duePlusGrace < utcDay(input.today)) return "PRESUNTA";
  return null;
}
