import type { InstallmentStatus } from "@prisma/client";

function startOfUtcDay(date: Date): number {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

/** Una cuota está vencida si sigue pendiente y su fecha de pago ya pasó. */
export function isInstallmentOverdue(
  status: InstallmentStatus,
  dueDate: Date,
): boolean {
  if (status !== "PENDIENTE") return false;
  return startOfUtcDay(dueDate) < startOfUtcDay(new Date());
}
