import type { CollectionReminderKind, InstallmentStatus } from "@prisma/client";

const DAY_MS = 86_400_000;

export function classifyCollectionReminder(
  status: InstallmentStatus,
  dueDate: Date,
  now = new Date(),
): CollectionReminderKind | null {
  if (status === "RECHAZADA") return "REJECTED";
  if (!["PENDIENTE", "PARCIAL"].includes(status)) return null;
  const days = Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      Date.UTC(
        dueDate.getUTCFullYear(),
        dueDate.getUTCMonth(),
        dueDate.getUTCDate(),
      )) /
      DAY_MS,
  );
  if (days >= 30) return "LAPSE";
  if (days > 0) return "OVERDUE";
  if (days >= -7) return "ADVANCE";
  return null;
}

export function localDateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function reminderDedupeKey(
  installmentId: string,
  kind: CollectionReminderKind,
  dateKey: string,
): string {
  return `${installmentId}:${kind}:${dateKey}`;
}
