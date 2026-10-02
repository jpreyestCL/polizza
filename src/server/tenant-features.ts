import "server-only";
import {
  DEFAULT_TENANT_FEATURES,
  TENANT_FEATURE_CODES,
  type TenantFeatureCode,
} from "@/lib/domain/tenant-features";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Crea los módulos que faltan con la semilla del MVP. */
export async function ensureTenantFeatures(db: Db, organizationId: string) {
  const existing: { code: string }[] = await db.tenantFeature.findMany({
    where: { organizationId },
    select: { code: true },
  });
  const have = new Set(existing.map((row) => row.code));
  const missing = TENANT_FEATURE_CODES.filter((code) => !have.has(code));
  if (missing.length === 0) return;
  await db.tenantFeature.createMany({
    data: missing.map((code) => ({
      organizationId,
      code,
      enabled: DEFAULT_TENANT_FEATURES[code],
    })),
  });
}

export async function featureEnabled(
  db: Db,
  organizationId: string,
  code: TenantFeatureCode,
): Promise<boolean> {
  await ensureTenantFeatures(db, organizationId);
  const row = await db.tenantFeature.findFirst({
    where: { organizationId, code },
    select: { enabled: true },
  });
  return row?.enabled ?? DEFAULT_TENANT_FEATURES[code];
}
