import { describe, expect, it, vi } from "vitest";
import { ensureOrganizationConfiguration } from "@/server/tenant-features";
import {
  DEFAULT_TENANT_FEATURES,
  TENANT_FEATURE_CODES,
} from "@/lib/domain/tenant-features";
import { auditActionLabel } from "@/lib/audit-catalog";

describe("bootstrap de configuración de corredora", () => {
  it("crea faltantes y se puede ejecutar repetidamente", async () => {
    const rows = new Map<string, boolean>();
    const db = {
      organizationSettings: {
        upsert: vi.fn().mockResolvedValue({
          organizationId: "org-1",
          presumedPaidEnabled: false,
          mfaRequired: false,
          ssoEnabled: false,
        }),
      },
      tenantFeature: {
        findMany: vi.fn(async () =>
          [...rows].map(([code, enabled]) => ({ code, enabled })),
        ),
        createMany: vi.fn(async ({ data }: { data: Array<{ code: string; enabled: boolean }> }) => {
          for (const row of data) rows.set(row.code, row.enabled);
          return { count: data.length };
        }),
      },
    };

    await ensureOrganizationConfiguration(db, "org-1");
    await ensureOrganizationConfiguration(db, "org-1");

    expect(db.organizationSettings.upsert).toHaveBeenCalledTimes(2);
    expect(db.tenantFeature.createMany).toHaveBeenCalledTimes(1);
    expect(db.tenantFeature.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(Object.fromEntries(rows)).toEqual(DEFAULT_TENANT_FEATURES);
    expect(rows.size).toBe(TENANT_FEATURE_CODES.length);
  });
});

describe("catálogo de auditoría", () => {
  it("traduce acciones conocidas y conserva las desconocidas", () => {
    expect(auditActionLabel("settings.updated")).toBe("Parámetros actualizados");
    expect(auditActionLabel("custom.event")).toBe("custom.event");
  });
});
