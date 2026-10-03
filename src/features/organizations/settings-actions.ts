"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrgDb } from "@/server/context";
import { logAudit } from "@/server/activity";
import { hasPermission } from "@/lib/factory-roles";
import {
  TENANT_FEATURE_CODES,
  type TenantFeatureCode,
} from "@/lib/domain/tenant-features";
import { ensureOrganizationConfiguration } from "@/server/tenant-features";

const PAGE = "/configuracion/parametros";

function checked(form: FormData, name: string): boolean {
  return form.get(name) === "on";
}

export async function updateOrganizationSettingsAction(
  form: FormData,
): Promise<void> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "settings.manage")) {
    redirect(`${PAGE}?aviso=permiso`);
  }

  await ensureOrganizationConfiguration(db, ctx.organizationId);
  const current = await db.organizationSettings.findUniqueOrThrow({
    where: { organizationId: ctx.organizationId },
  });
  const currentFeatures: { code: string; enabled: boolean }[] =
    await db.tenantFeature.findMany();
  const byCode = new Map(currentFeatures.map((row) => [row.code, row.enabled]));

  const nextSettings = {
    presumedPaidEnabled: checked(form, "presumedPaidEnabled"),
    mfaRequired: checked(form, "mfaRequired"),
    ssoEnabled: checked(form, "ssoEnabled"),
  };
  const diff: Record<string, { before: boolean; after: boolean }> = {};
  for (const [key, after] of Object.entries(nextSettings)) {
    const before = Boolean(current[key as keyof typeof nextSettings]);
    if (before !== after) diff[key] = { before, after };
  }

  if (Object.keys(diff).length > 0) {
    await db.organizationSettings.update({
      where: { organizationId: ctx.organizationId },
      data: { ...nextSettings, updatedById: ctx.userId },
    });
  }

  await Promise.all(
    TENANT_FEATURE_CODES.map(async (code: TenantFeatureCode) => {
      const after = checked(form, `feature:${code}`);
      const before = byCode.get(code) ?? false;
      if (before === after) return;
      diff[`feature.${code}`] = { before, after };
      await db.tenantFeature.update({
        where: {
          organizationId_code: { organizationId: ctx.organizationId, code },
        },
        data: { enabled: after },
      });
    }),
  );

  if (Object.keys(diff).length > 0) {
    await logAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "settings.updated",
      metadata: { diff },
    });
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?aviso=guardado`);
}
