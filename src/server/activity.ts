import "server-only";
import type { EntityType, Prisma } from "@prisma/client";
import { headers } from "next/headers";
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
  let ipAddress = input.ipAddress;
  let userAgent = input.userAgent;
  if (ipAddress === undefined || userAgent === undefined) {
    try {
      const requestHeaders = await headers();
      ipAddress ??=
        requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        requestHeaders.get("x-real-ip");
      userAgent ??= requestHeaders.get("user-agent");
    } catch {
      // También se usa desde procesos sin request; IP y UA son opcionales.
    }
  }
  await basePrisma.auditLog.create({
    data: {
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  });
}
