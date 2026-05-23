"use server";

import { revalidatePath } from "next/cache";
import { requireOrgDb } from "@/server/context";
import { logActivity } from "@/server/activity";
import {
  endorsementSchema,
  ENDORSEMENT_TYPE_LABELS,
  type EndorsementValues,
} from "./schemas";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function toNullable(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

function toDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createEndorsementAction(
  policyId: string,
  raw: EndorsementValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = endorsementSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const effective = toDate(parsed.data.effectiveDate);
  if (!effective) return { ok: false, error: "Fecha inválida" };

  const { ctx, db } = await requireOrgDb();
  const policy = await db.policy.findFirst({
    where: { id: policyId },
    select: { id: true, policyNumber: true, status: true },
  });
  if (!policy) return { ok: false, error: "Póliza no existe." };

  // Validar transición
  if (
    parsed.data.type === "CANCELACION" &&
    !["VIGENTE", "VENCIDA"].includes(policy.status)
  ) {
    return {
      ok: false,
      error: "Solo se puede cancelar una póliza vigente o vencida.",
    };
  }
  if (
    parsed.data.type === "ANULACION" &&
    policy.status === "ANULADA"
  ) {
    return { ok: false, error: "La póliza ya está anulada." };
  }

  // Crear endoso
  const created = await db.endorsement.create({
    data: {
      organizationId: ctx.organizationId,
      policyId,
      type: parsed.data.type,
      effectiveDate: effective,
      reason: toNullable(parsed.data.reason),
      notes: toNullable(parsed.data.notes),
      createdById: ctx.userId,
    },
    select: { id: true },
  });

  // Cambiar estado de la póliza según tipo
  if (parsed.data.type === "CANCELACION" || parsed.data.type === "ANULACION") {
    const nextStatus = parsed.data.type === "CANCELACION" ? "CANCELADA" : "ANULADA";
    await db.policy.update({
      where: { id: policyId },
      data: { status: nextStatus },
    });
    await db.policyStatusHistory.create({
      data: {
        organizationId: ctx.organizationId,
        policyId,
        status: nextStatus,
        note: `Endoso de ${ENDORSEMENT_TYPE_LABELS[parsed.data.type].toLowerCase()}${
          parsed.data.reason ? ": " + parsed.data.reason : ""
        }`,
        changedById: ctx.userId,
      },
    });
  }

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "POLICY",
    entityId: policyId,
    action: "endorsement_created",
    summary: `${ENDORSEMENT_TYPE_LABELS[parsed.data.type]} de póliza ${policy.policyNumber}`,
    userId: ctx.userId,
  });

  revalidatePath(`/polizas/${policyId}`);
  return { ok: true, data: { id: created.id } };
}

export async function deleteEndorsementAction(
  endorsementId: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  const endorsement = await db.endorsement.findFirst({
    where: { id: endorsementId },
    select: { id: true, policyId: true, type: true },
  });
  if (!endorsement) return { ok: false, error: "Endoso no existe." };

  // Si era cancelación/anulación y es el último endoso de ese tipo, revertir estado de la póliza.
  if (endorsement.type === "CANCELACION" || endorsement.type === "ANULACION") {
    const others = await db.endorsement.count({
      where: {
        policyId: endorsement.policyId,
        type: endorsement.type,
        NOT: { id: endorsement.id },
      },
    });
    if (others === 0) {
      await db.policy.update({
        where: { id: endorsement.policyId },
        data: { status: "VIGENTE" },
      });
      await db.policyStatusHistory.create({
        data: {
          organizationId: ctx.organizationId,
          policyId: endorsement.policyId,
          status: "VIGENTE",
          note: "Endoso revertido — póliza vuelve a vigente",
          changedById: ctx.userId,
        },
      });
    }
  }

  await db.endorsement.delete({ where: { id: endorsementId } });
  revalidatePath(`/polizas/${endorsement.policyId}`);
  return { ok: true };
}
