"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { hasPermission } from "@/lib/factory-roles";
import { extractPolicyText } from "@/lib/domain/extraction";
import { featureEnabled } from "@/server/tenant-features";

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function extractTextAction(form: FormData): Promise<void> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "ai.extract")) {
    redirect("/extraccion?aviso=permiso");
  }
  if (!(await featureEnabled(db, ctx.organizationId, "AI_EXTRACTION"))) {
    redirect("/extraccion?aviso=FEATURE_DISABLED");
  }
  const sourceText = text(form, "sourceText");
  if (sourceText.length < 20) {
    redirect("/extraccion?aviso=texto");
  }
  const draft = extractPolicyText(sourceText);
  await db.aiExtraction.create({
    data: {
      organizationId: ctx.organizationId,
      sourceKind: text(form, "sourceKind") || "POLICY",
      sourceText,
      status: draft.status,
      policyNumber: draft.policyNumber,
      premiumNet:
        draft.premiumNet == null
          ? null
          : new Prisma.Decimal(draft.premiumNet.toFixed(4)),
      startDate: draft.startDate,
      endDate: draft.endDate,
      evidence: draft.evidence,
      createdById: ctx.userId,
    },
  });
  revalidatePath("/extraccion");
  redirect("/extraccion?aviso=lista");
}

export async function reviewExtractionAction(form: FormData): Promise<void> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "ai.extract")) {
    redirect("/extraccion?aviso=permiso");
  }
  const id = text(form, "id");
  const decision = text(form, "decision");
  if (decision !== "ACCEPTED" && decision !== "REJECTED") {
    redirect("/extraccion?aviso=decision");
  }
  const row = await db.aiExtraction.findFirst({
    where: { id },
    select: { id: true },
  });
  if (!row) redirect("/extraccion?aviso=no");
  await db.aiExtraction.update({
    where: { id },
    data: {
      status: decision,
      reviewNote: text(form, "note") || null,
    },
  });
  revalidatePath("/extraccion");
  redirect("/extraccion?aviso=revisada");
}
