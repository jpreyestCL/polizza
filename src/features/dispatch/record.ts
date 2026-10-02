import type { Db } from "@/server/db";
import { nextDispatchStatus } from "@/lib/domain/dispatch-flow";

/** Abre la cola cuando la propuesta queda por despachar. */
export async function ensureDispatchQueued(
  db: Db,
  args: { organizationId: string; proposalId: string },
): Promise<void> {
  const existing = await db.dispatch.findFirst({
    where: { proposalId: args.proposalId },
    select: { id: true, status: true },
  });
  if (nextDispatchStatus(existing?.status ?? null, "queue") == null) return;
  await db.dispatch.create({
    data: {
      organizationId: args.organizationId,
      proposalId: args.proposalId,
      status: "PENDIENTE",
    },
  });
}

/** Marca el despacho enviado y lo enlaza a la póliza de cartera. */
export async function markDispatchSent(
  db: Db,
  args: {
    organizationId: string;
    proposalId: string;
    policyId: string | null;
    recipientEmail: string | null;
  },
): Promise<void> {
  const existing = await db.dispatch.findFirst({
    where: { proposalId: args.proposalId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  if (!existing) {
    await db.dispatch.create({
      data: {
        organizationId: args.organizationId,
        proposalId: args.proposalId,
        policyId: args.policyId,
        status: "ENVIADO",
        recipientEmail: args.recipientEmail,
        sentAt: new Date(),
      },
    });
    return;
  }
  if (nextDispatchStatus(existing.status, "send") == null && existing.status !== "ENVIADO") {
    return;
  }
  await db.dispatch.update({
    where: { id: existing.id },
    data: {
      status: "ENVIADO",
      policyId: args.policyId,
      recipientEmail: args.recipientEmail,
      sentAt: new Date(),
    },
  });
}
