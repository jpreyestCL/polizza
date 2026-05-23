"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { logActivity } from "@/server/activity";
import { sanitizeRichText } from "@/lib/sanitize";
import {
  proposalItemSchema,
  validateItemData,
  type ProposalItemValues,
} from "./schemas";
import { getBranchFieldSchemas, type BranchFieldDef } from "./queries";

const RICHTEXT_KEY_HINTS = new Set([
  "materiaasegurada",
  "materia_asegurada",
  "subjectmatter",
  "subject_matter",
]);

function sanitizeItemData(
  fields: BranchFieldDef[],
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const f of fields) {
    const key = f.fieldKey.toLowerCase().replace(/[_\s-]/g, "");
    const isRich = f.type === "richtext" || RICHTEXT_KEY_HINTS.has(key);
    if (isRich && typeof out[f.fieldKey] === "string") {
      out[f.fieldKey] = sanitizeRichText(out[f.fieldKey] as string);
    }
  }
  return out;
}

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function toNullable(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

export async function createProposalItemAction(
  proposalId: string,
  raw: ProposalItemValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = proposalItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { ctx, db } = await requireOrgDb();
  const proposal = await db.proposal.findFirst({
    where: { id: proposalId },
    select: {
      id: true,
      proposalNumber: true,
      insuredClientId: true,
      beneficiaryClientId: true,
      productId: true,
      status: true,
    },
  });
  if (!proposal) {
    return { ok: false, error: "Propuesta no existe." };
  }
  if (
    proposal.status !== "ELABORACION" &&
    proposal.status !== "DEVUELTA"
  ) {
    return {
      ok: false,
      error: "La propuesta está bloqueada. Reábrela para editar ítems.",
    };
  }

  const fields = await getBranchFieldSchemas(parsed.data.branchTypeId);
  const validation = validateItemData(fields, parsed.data.data);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const last = await db.proposalItem.findFirst({
    where: { proposalId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  // Cargar coberturas del producto para auto-poblar el ítem (extension D).
  const productCoverages = proposal.productId
    ? await db.tenantProductCoverage.findMany({
        where: { productId: proposal.productId },
        orderBy: { order: "asc" },
      })
    : [];

  const created = await db.$transaction(async (tx) => {
    const item = await tx.proposalItem.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId,
        branchTypeId: parsed.data.branchTypeId,
        order: (last?.order ?? 0) + 10,
        insuredClientId:
          toNullable(parsed.data.insuredClientId) ?? proposal.insuredClientId,
        beneficiaryClientId:
          toNullable(parsed.data.beneficiaryClientId) ??
          proposal.beneficiaryClientId,
        identification: toNullable(parsed.data.identification),
        glossNote: toNullable(parsed.data.glossNote),
        data: sanitizeItemData(fields, parsed.data.data) as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    if (productCoverages.length > 0) {
      await tx.proposalItemCoverage.createMany({
        data: productCoverages.map((c, idx) => ({
          organizationId: ctx.organizationId,
          itemId: item.id,
          order: c.order ?? idx * 10,
          name: c.name,
          polCad: c.polCad,
          type: c.type,
          isCommercialValue: c.isCommercialValue,
          insuredAmount: c.insuredAmount,
          affectedByIva: c.affectedByIva,
          premiumNet: c.premium,
          sumsToTotal: c.sumsToTotal,
          autoLoaded: true,
        })),
      });
    }
    return item;
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "PROPOSAL",
    entityId: proposalId,
    action: "item_created",
    summary: `Ítem agregado en ${proposal.proposalNumber}`,
    userId: ctx.userId,
  });

  await db.proposalLog.create({
    data: {
      organizationId: ctx.organizationId,
      proposalId,
      action: "ITEM_CREATED",
      summary: "Ítem creado",
      userId: ctx.userId,
    },
  });

  revalidatePath(`/propuestas/${proposalId}`);
  return { ok: true, data: { id: created.id } };
}

export async function updateProposalItemAction(
  itemId: string,
  raw: ProposalItemValues,
): Promise<ActionResult> {
  const parsed = proposalItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { ctx, db } = await requireOrgDb();
  const existing = await db.proposalItem.findFirst({
    where: { id: itemId },
    select: {
      id: true,
      proposalId: true,
      proposal: { select: { status: true } },
    },
  });
  if (!existing) return { ok: false, error: "Ítem no existe." };
  if (
    existing.proposal.status !== "ELABORACION" &&
    existing.proposal.status !== "DEVUELTA"
  ) {
    return {
      ok: false,
      error: "La propuesta está bloqueada. Reábrela para editar ítems.",
    };
  }

  const fields = await getBranchFieldSchemas(parsed.data.branchTypeId);
  const validation = validateItemData(fields, parsed.data.data);
  if (!validation.ok) return { ok: false, error: validation.error };

  await db.proposalItem.update({
    where: { id: itemId },
    data: {
      branchTypeId: parsed.data.branchTypeId,
      insuredClientId: toNullable(parsed.data.insuredClientId),
      beneficiaryClientId: toNullable(parsed.data.beneficiaryClientId),
      identification: toNullable(parsed.data.identification),
      glossNote: toNullable(parsed.data.glossNote),
      data: parsed.data.data as Prisma.InputJsonValue,
    },
  });

  await db.proposalLog.create({
    data: {
      organizationId: ctx.organizationId,
      proposalId: existing.proposalId,
      action: "ITEM_UPDATED",
      summary: "Ítem actualizado",
      userId: ctx.userId,
    },
  });

  revalidatePath(`/propuestas/${existing.proposalId}`);
  return { ok: true };
}

export async function deleteProposalItemAction(
  itemId: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  const item = await db.proposalItem.findFirst({
    where: { id: itemId },
    select: {
      proposalId: true,
      proposal: { select: { status: true } },
    },
  });
  if (!item) return { ok: false, error: "Ítem no existe." };
  if (
    item.proposal.status !== "ELABORACION" &&
    item.proposal.status !== "DEVUELTA"
  ) {
    return {
      ok: false,
      error: "La propuesta está bloqueada. Reábrela para editar ítems.",
    };
  }
  await db.proposalItem.delete({ where: { id: itemId } });
  await db.proposalLog.create({
    data: {
      organizationId: ctx.organizationId,
      proposalId: item.proposalId,
      action: "ITEM_DELETED",
      summary: "Ítem eliminado",
      userId: ctx.userId,
    },
  });
  revalidatePath(`/propuestas/${item.proposalId}`);
  return { ok: true };
}

/** Carga masiva desde un array de filas (xlsx parseado en cliente). */
export async function bulkCreateItemsAction(
  proposalId: string,
  branchTypeId: string,
  rows: Record<string, unknown>[],
): Promise<ActionResult<{ count: number }>> {
  const { ctx, db } = await requireOrgDb();
  const proposal = await db.proposal.findFirst({
    where: { id: proposalId },
    select: {
      id: true,
      proposalNumber: true,
      insuredClientId: true,
      beneficiaryClientId: true,
    },
  });
  if (!proposal) return { ok: false, error: "Propuesta no existe." };

  const fields = await getBranchFieldSchemas(branchTypeId);
  if (fields.length === 0) {
    return { ok: false, error: "El ramo seleccionado no tiene ficha definida." };
  }

  let nextOrder = 10;
  const last = await db.proposalItem.findFirst({
    where: { proposalId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  if (last) nextOrder = last.order + 10;

  const errors: string[] = [];
  const valid: Prisma.ProposalItemCreateManyInput[] = [];
  rows.forEach((row, idx) => {
    // Mapear columnas por fieldKey o por label
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      const v = row[f.fieldKey] ?? row[f.label];
      if (v !== undefined && v !== null && v !== "") data[f.fieldKey] = v;
    }
    const validation = validateItemData(fields, data);
    if (!validation.ok) {
      errors.push(`Fila ${idx + 2}: ${validation.error}`);
      return;
    }
    valid.push({
      organizationId: ctx.organizationId,
      proposalId,
      branchTypeId,
      order: nextOrder,
      insuredClientId: proposal.insuredClientId,
      beneficiaryClientId: proposal.beneficiaryClientId,
      identification: typeof row.identificacion === "string" ? row.identificacion : null,
      glossNote: typeof row.comentarios === "string" ? row.comentarios : null,
      data: data as Prisma.InputJsonValue,
    });
    nextOrder += 10;
  });

  if (errors.length > 0 && valid.length === 0) {
    return { ok: false, error: errors.join("\n") };
  }

  if (valid.length > 0) {
    await db.proposalItem.createMany({ data: valid });
    await db.proposalLog.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId,
        action: "ITEMS_BULK_CREATED",
        summary: `Carga masiva: ${valid.length} ítems agregados`,
        userId: ctx.userId,
      },
    });
  }

  revalidatePath(`/propuestas/${proposalId}`);
  if (errors.length > 0) {
    return {
      ok: false,
      error: `${valid.length} ítems creados; ${errors.length} con error:\n${errors.join("\n")}`,
    };
  }
  return { ok: true, data: { count: valid.length } };
}
