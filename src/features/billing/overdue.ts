import type { InstallmentStatus } from "@prisma/client";

function startOfUtcDay(date: Date): number {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

const OPEN_INSTALLMENT_STATUSES = new Set<InstallmentStatus>([
  "PENDIENTE",
  "PARCIAL",
  "RECHAZADA",
]);

/**
 * Vencida no es un estado. Es una cuota abierta (pendiente, parcial o
 * rechazada) cuya fecha ya pasó. Presunta, pagada, castigada y anulada no.
 */
export function isInstallmentOverdue(
  status: InstallmentStatus,
  dueDate: Date,
  now: Date = new Date(),
): boolean {
  if (!OPEN_INSTALLMENT_STATUSES.has(status)) return false;
  return startOfUtcDay(dueDate) < startOfUtcDay(now);
}
