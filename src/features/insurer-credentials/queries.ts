import "server-only";
import type { Db } from "@/server/db";

export type CredentialItem = {
  id: string;
  insurerKey: string;
  insurerName: string;
  username: string;
  status: string;
  notes: string | null;
  updatedAt: Date;
};

export async function listCredentials(db: Db): Promise<CredentialItem[]> {
  return db.insurerPortalCredential.findMany({
    orderBy: { insurerName: "asc" },
    select: {
      id: true,
      insurerKey: true,
      insurerName: true,
      username: true,
      status: true,
      notes: true,
      updatedAt: true,
    },
  });
}
