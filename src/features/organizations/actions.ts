"use server";

import { requireOrgDb } from "@/server/context";
import { seedOrganizationCatalog } from "@/server/seed-org";

/**
 * Inicializa una corredora recién creada con su catálogo base de compañías y
 * ramos. Se invoca tras crear la organización en el registro. Idempotente.
 */
export async function bootstrapOrganizationAction(): Promise<{ ok: boolean }> {
  const { ctx, db } = await requireOrgDb();
  await seedOrganizationCatalog(db, ctx.organizationId);
  return { ok: true };
}
