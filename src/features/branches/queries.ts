import "server-only";
import type { Db } from "@/server/db";

export type BranchItem = {
  id: string;
  name: string;
  address: string | null;
  contactName: string | null;
  region: string | null;
  commune: string | null;
  phone: string | null;
  celular: string | null;
  email: string | null;
};

/** Sucursales de toda la corredora, para mostrar el selector en propuestas y pólizas. */
export async function listOrgBranches(
  db: Db,
): Promise<{ id: string; name: string; clientId: string }[]> {
  return db.branch.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, clientId: true },
  });
}

/** Sucursales de un cliente. */
export async function listClientBranches(
  db: Db,
  clientId: string,
): Promise<BranchItem[]> {
  return db.branch.findMany({
    where: { clientId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      contactName: true,
      region: true,
      commune: true,
      phone: true,
      celular: true,
      email: true,
    },
  });
}
