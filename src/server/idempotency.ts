import "server-only";
import { createHash } from "crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export function commandFingerprint(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export type IdempotencyHit =
  | { kind: "fresh" }
  | { kind: "replay"; resultJson: unknown }
  | { kind: "conflict" };

export async function readIdempotency(
  db: Db,
  organizationId: string,
  key: string,
  fingerprint: string,
): Promise<IdempotencyHit> {
  const row = await db.idempotencyRecord.findFirst({
    where: { organizationId, key },
    select: { fingerprint: true, resultJson: true },
  });
  if (!row) return { kind: "fresh" };
  if (row.fingerprint !== fingerprint) return { kind: "conflict" };
  return { kind: "replay", resultJson: row.resultJson };
}

export async function storeIdempotency(
  db: Db,
  input: {
    organizationId: string;
    key: string;
    fingerprint: string;
    command: string;
    resultJson: unknown;
  },
): Promise<void> {
  await db.idempotencyRecord.create({
    data: {
      organizationId: input.organizationId,
      key: input.key,
      fingerprint: input.fingerprint,
      command: input.command,
      resultJson: input.resultJson ?? {},
    },
  });
}
