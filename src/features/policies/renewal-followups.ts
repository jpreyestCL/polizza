import "server-only";
import type { Db } from "@/server/db";
import { RENEWAL_TASK_OFFSETS, RENEWAL_WINDOW_DAYS } from "@/lib/domain/renewal-status";
import { addCalendarDays } from "@/lib/domain/claim-lifecycle";
import { calendarDaysBetween } from "@/lib/domain/term";

/**
 * Crea las tareas de seguimiento a 45, 30 y 15 días del fin, una vez
 * que esa fecha ya llegó. No duplica la misma tarea.
 */
export async function ensureRenewalFollowups(
  db: Db,
  organizationId: string,
): Promise<void> {
  const now = new Date();
  const horizon = addCalendarDays(now, RENEWAL_WINDOW_DAYS);
  const policies = await db.policy.findMany({
    where: {
      status: { in: ["VIGENTE", "VENCIDA"] },
      notRenewable: false,
      nonRenewalAt: null,
      endDate: { not: null, lte: horizon },
    },
    select: {
      id: true,
      policyNumber: true,
      endDate: true,
      assignedUserId: true,
    },
    take: 200,
  });
  for (const policy of policies) {
    if (!policy.endDate) continue;
    const daysLeft = calendarDaysBetween(now, policy.endDate);
    for (const offset of RENEWAL_TASK_OFFSETS) {
      if (daysLeft > offset) continue;
      const title = `Renovación ${policy.policyNumber}: seguimiento a ${offset} días`;
      const existing = await db.task.findFirst({
        where: { entityType: "POLICY", entityId: policy.id, title },
        select: { id: true },
      });
      if (existing) continue;
      await db.task.create({
        data: {
          organizationId,
          title,
          description: "Seguimiento de la renovación antes del fin de vigencia.",
          entityType: "POLICY",
          entityId: policy.id,
          assignedUserId: policy.assignedUserId,
          dueDate: addCalendarDays(policy.endDate, -offset),
          priority: offset <= 15 ? "ALTA" : "MEDIA",
          status: "PENDIENTE",
        },
      });
    }
  }
}
