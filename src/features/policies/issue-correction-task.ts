import "server-only";
import { basePrisma } from "@/server/db";
import { addBusinessDays, dayKey } from "@/lib/working-days";

export const ISSUE_CORRECTION_TITLE = "Solicitar endoso de corrección";
const ISSUE_CORRECTION_BUSINESS_DAYS = 10;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/**
 * La comparación no bloquea la emisión. Con problemas queda esta tarea,
 * con plazo de 10 días hábiles, para pedir el endoso que corrige.
 */
export async function ensureIssueCorrectionTask(
  db: Db,
  input: {
    organizationId: string;
    userId: string;
    entityType: "PROPOSAL" | "POLICY";
    entityId: string;
    reason: string;
    detail?: string | null;
    assignedUserId?: string | null;
  },
): Promise<void> {
  const existing = await db.task.findFirst({
    where: {
      entityType: input.entityType,
      entityId: input.entityId,
      title: ISSUE_CORRECTION_TITLE,
      status: { in: ["PENDIENTE", "EN_PROGRESO"] },
    },
    select: { id: true },
  });
  if (existing) return;

  const holidays: { date: Date }[] = await basePrisma.holiday.findMany({
    select: { date: true },
  });
  const dueDate = addBusinessDays(
    new Date(),
    ISSUE_CORRECTION_BUSINESS_DAYS,
    new Set(holidays.map((holiday) => dayKey(holiday.date))),
  );
  await db.task.create({
    data: {
      organizationId: input.organizationId,
      title: ISSUE_CORRECTION_TITLE,
      description: [input.reason, input.detail].filter(Boolean).join(" — "),
      entityType: input.entityType,
      entityId: input.entityId,
      assignedUserId: input.assignedUserId ?? input.userId,
      dueDate,
      priority: "ALTA",
      status: "PENDIENTE",
      createdById: input.userId,
    },
  });
}

/** Al despachar, la tarea sigue a la póliza de cartera. */
export async function moveIssueCorrectionTaskToPolicy(
  db: Db,
  proposalId: string,
  policyId: string,
): Promise<void> {
  await db.task.updateMany({
    where: {
      entityType: "PROPOSAL",
      entityId: proposalId,
      title: ISSUE_CORRECTION_TITLE,
      status: { in: ["PENDIENTE", "EN_PROGRESO"] },
    },
    data: { entityType: "POLICY", entityId: policyId },
  });
}
