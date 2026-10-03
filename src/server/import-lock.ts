import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Serializes application of one tenant/profile/file tuple. This closes the
 * race that a preflight duplicate query alone cannot prevent.
 */
export async function lockImportFile(
  tx: Pick<Prisma.TransactionClient, "$queryRaw">,
  organizationId: string,
  profile: string,
  fileSha256: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${organizationId}),
      hashtext(${`${profile}:${fileSha256}`})
    )
  `;
}
