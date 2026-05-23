import "server-only";
import type { EntityType, Prisma } from "@prisma/client";
import { basePrisma, type Db } from "@/server/db";

/**
 * Registra un evento de dominio en la bitácora (ActivityLog).
 * Recibe el cliente Prisma acotado al tenant — el organizationId se inyecta solo.
 */
export async function logActivity(
  db: Db,
  input: {
    organizationId: string;
    entityType: EntityType;
    entityId: string;
    action: string;
    summary: string;
    userId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await db.activityLog.create({
    data: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary,
      userId: input.userId ?? null,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  });
}

/**
 * Registra un evento de seguridad/auditoría (AuditLog).
 * Usa el cliente base: los eventos de auth pueden no tener organización.
 */
export async function logAudit(input: {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await basePrisma.auditLog.create({
    data: {
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  });
}
