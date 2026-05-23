import "server-only";
import type { ClaimStatus } from "@prisma/client";
import type { SessionContext } from "@/server/context";
import type { Db } from "@/server/db";
import { canSeeAllClients } from "@/lib/roles";

export type ClaimListItem = {
  id: string;
  claimNumber: string;
  status: ClaimStatus;
  description: string;
  occurredAt: Date | null;
  estimatedAmount: number | null;
  settledAmount: number | null;
  currency: string;
  clientId: string;
  policyId: string | null;
  assignedUserId: string | null;
  createdAt: Date;
  client: { id: string; name: string };
};

/** Siniestros acotados por rol. */
export async function listClaims(
  ctx: SessionContext,
  db: Db,
): Promise<ClaimListItem[]> {
  const rows = await db.claim.findMany({
    where: canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      claimNumber: true,
      status: true,
      description: true,
      occurredAt: true,
      estimatedAmount: true,
      settledAmount: true,
      currency: true,
      clientId: true,
      policyId: true,
      assignedUserId: true,
      createdAt: true,
      client: { select: { id: true, name: true } },
    },
  });

  return rows.map((claim) => ({
    ...claim,
    estimatedAmount: claim.estimatedAmount
      ? Number(claim.estimatedAmount)
      : null,
    settledAmount: claim.settledAmount ? Number(claim.settledAmount) : null,
  }));
}

/** Detalle de un siniestro con cliente e historial de estados. */
export async function getClaimDetail(db: Db, id: string) {
  const claim = await db.claim.findFirst({
    where: { id },
    include: {
      client: { select: { id: true, name: true, rut: true } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!claim) return null;
  return {
    ...claim,
    estimatedAmount: claim.estimatedAmount
      ? Number(claim.estimatedAmount)
      : null,
    settledAmount: claim.settledAmount ? Number(claim.settledAmount) : null,
  };
}

export type ClaimDetail = NonNullable<
  Awaited<ReturnType<typeof getClaimDetail>>
>;

/** Siniestros de un cliente, para la ficha 360°. */
export async function listClientClaims(db: Db, clientId: string) {
  return db.claim.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      claimNumber: true,
      status: true,
      occurredAt: true,
    },
  });
}

/** Bitácora de actividad de un siniestro. */
export async function getClaimActivity(db: Db, claimId: string) {
  return db.activityLog.findMany({
    where: { entityType: "CLAIM", entityId: claimId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
