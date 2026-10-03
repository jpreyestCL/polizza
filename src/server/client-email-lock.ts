import "server-only";
import type { Prisma } from "@prisma/client";

/** Serializa la validación y escritura de correos dentro de una corredora. */
export async function lockClientEmails(
  tx: Pick<Prisma.TransactionClient, "$executeRaw">,
  organizationId: string,
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${"client-email:" + organizationId}))
  `;
}
