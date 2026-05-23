"use server";

import { revalidatePath } from "next/cache";
import { requireOrgDb } from "@/server/context";
import { basePrisma } from "@/server/db";
import {
  proposalSettingsSchema,
  type ProposalSettingsValues,
  type ProposalSettingsResult,
} from "./proposal-settings-constants";

export async function getProposalSettings() {
  const { ctx } = await requireOrgDb();
  const org = await basePrisma.organization.findUnique({
    where: { id: ctx.organizationId },
    select: {
      reservaDays: true,
      proposalNumberPattern: true,
      proposalSequenceYear: true,
      proposalSequenceValue: true,
      timezone: true,
    },
  });
  return org;
}

export async function updateProposalSettingsAction(
  values: ProposalSettingsValues,
): Promise<ProposalSettingsResult> {
  const parsed = proposalSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
  }
  const { ctx } = await requireOrgDb();
  await basePrisma.organization.update({
    where: { id: ctx.organizationId },
    data: {
      reservaDays: parsed.data.reservaDays,
      proposalNumberPattern: parsed.data.proposalNumberPattern,
      timezone: parsed.data.timezone,
    },
  });
  revalidatePath("/configuracion/propuestas");
  return { ok: true };
}
