"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { basePrisma } from "@/server/db";
import { logActivity } from "@/server/activity";
import { generateProposalNumber } from "@/features/proposals/number-generator";
import { isProposalLocked } from "@/features/proposals/schemas";
import { applyEndorsementToPolicy } from "./apply";
import {
  endorsementSchema,
  endorsementProposalSchema,
  endorsementTransitionError,
  ENDORSEMENT_TYPE_LABELS,
  endorsementStatusEffect,
  type EndorsementValues,
  type EndorsementProposalValues,
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

/**
 * Nuevo endoso sobre una póliza.
 *  - mode PROPUESTA: crea una propuesta de endoso (Proposal kind ENDOSO) que
 *    sigue el flujo de propuestas; devuelve `proposalId` para abrirla.
 *  - mode DIRECTO: registra el endoso ya emitido y aplica su efecto de estado.
 */
export async function createEndorsementAction(
  policyId: string,
  raw: EndorsementValues,
): Promise<ActionResult<{ id: string; proposalId?: string }>> {
  const parsed = endorsementSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;
  const effective = toDate(data.effectiveDate);
  if (!effective) return { ok: false, error: "Fecha inválida" };
  const endDate = toDate(data.endDate);

  const { ctx, db } = await requireOrgDb();
  const policy = await db.policy.findFirst({
    where: { id: policyId },
    select: {
      id: true,
      policyNumber: true,
      status: true,
      clientId: true,
      proposalId: true,
      companyId: true,
      lineId: true,
      branchId: true,
      productId: true,
      currency: true,
      endDate: true,
      commissionPercent: true,
      assignedUserId: true,
      salespersonId: true,
    },
  });
  if (!policy) return { ok: false, error: "Póliza no existe." };

  // Se valida al crear para no armar una propuesta que después no se pueda
  // aplicar (se vuelve a validar al despachar).
  const transitionError = endorsementTransitionError(data.type, policy.status);
  if (transitionError) return { ok: false, error: transitionError };

  const label = ENDORSEMENT_TYPE_LABELS[data.type];

  if (data.mode === "DIRECTO") {
    const result = await db.$transaction((tx) =>
      applyEndorsementToPolicy(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        policyId,
        type: data.type,
        effectiveDate: effective,
        endDate,
        endorsementNumber: toNullable(data.endorsementNumber),
        detail: toNullable(data.detail),
        notes: toNullable(data.notes),
        proposalId: null,
      }),
    );
    if (!result.ok) return result;

    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "POLICY",
      entityId: policyId,
      action: "endorsement_created",
      summary: `${label} de póliza ${policy.policyNumber}`,
      userId: ctx.userId,
    });
    revalidatePath(`/polizas/${policyId}`);
    return { ok: true, data: { id: result.id } };
  }

  // Propuesta de endoso: hereda de la póliza (y de su propuesta de origen, si
  // la hay) los datos que van en la "Solicitud de Endoso".
  const source = policy.proposalId
    ? await db.proposal.findFirst({
        where: { id: policy.proposalId },
        select: {
          branchTypeId: true,
          insuredClientId: true,
          beneficiaryClientId: true,
          recipientEmail: true,
          recipientContactId: true,
          contratanteEmail: true,
          contratantePhone: true,
          contratanteCelular: true,
          commissionAffectPct: true,
          commissionExemptPct: true,
          startTime: true,
          endTime: true,
        },
      })
    : null;

  try {
    const proposalNumber = await generateProposalNumber(
      basePrisma,
      ctx.organizationId,
    );
    const proposal = await db.$transaction(async (tx) => {
      const created = await tx.proposal.create({
        data: {
          organizationId: ctx.organizationId,
          kind: "ENDOSO",
          endorsedPolicyId: policy.id,
          endorsementType: data.type,
          endorsementDetail: data.detail,
          observations: toNullable(data.notes),
          clientId: policy.clientId,
          proposalNumber,
          companyId: policy.companyId,
          lineId: policy.lineId,
          branchId: policy.branchId,
          branchTypeId: source?.branchTypeId ?? null,
          productId: policy.productId,
          insuredClientId: source?.insuredClientId ?? null,
          beneficiaryClientId: source?.beneficiaryClientId ?? null,
          recipientEmail: source?.recipientEmail ?? null,
          recipientContactId: source?.recipientContactId ?? null,
          contratanteEmail: source?.contratanteEmail ?? null,
          contratantePhone: source?.contratantePhone ?? null,
          contratanteCelular: source?.contratanteCelular ?? null,
          commissionAffectPct:
            source?.commissionAffectPct ?? policy.commissionPercent ?? null,
          commissionExemptPct: source?.commissionExemptPct ?? null,
          status: "ELABORACION",
          currency: policy.currency,
          startDate: effective,
          endDate: endDate ?? policy.endDate,
          startTime: source?.startTime ?? null,
          endTime: source?.endTime ?? null,
          assignedUserId: policy.assignedUserId ?? ctx.userId,
          salespersonId: policy.salespersonId,
          currentStateStartedAt: new Date(),
          createdById: ctx.userId,
        },
        select: { id: true, proposalNumber: true },
      });
      await tx.proposalStatusHistory.create({
        data: {
          organizationId: ctx.organizationId,
          proposalId: created.id,
          status: "ELABORACION",
          note: `Propuesta de endoso (${label.toLowerCase()}) de la póliza ${policy.policyNumber}`,
          changedById: ctx.userId,
        },
      });
      await tx.proposalLog.create({
        data: {
          organizationId: ctx.organizationId,
          proposalId: created.id,
          action: "CREATED",
          summary: `Propuesta de endoso creada desde la póliza ${policy.policyNumber}`,
          userId: ctx.userId,
        },
      });
      return created;
    });

    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "POLICY",
      entityId: policyId,
      action: "endorsement_proposal_created",
      summary: `Propuesta de endoso N° ${proposal.proposalNumber} (${label}) de póliza ${policy.policyNumber}`,
      userId: ctx.userId,
    });

    revalidatePath(`/polizas/${policyId}`);
    revalidatePath("/propuestas");
    return { ok: true, data: { id: proposal.id, proposalId: proposal.id } };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Conflicto al numerar la propuesta. Intenta nuevamente.",
      };
    }
    throw error;
  }
}

/** Edita una propuesta de endoso mientras no esté bloqueada. */
export async function updateEndorsementProposalAction(
  proposalId: string,
  raw: EndorsementProposalValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = endorsementProposalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;
  const effective = toDate(data.effectiveDate);
  if (!effective) return { ok: false, error: "Fecha inválida" };

  const { ctx, db } = await requireOrgDb();
  const proposal = await db.proposal.findFirst({
    where: { id: proposalId, kind: "ENDOSO" },
    select: { id: true, status: true, proposalNumber: true },
  });
  if (!proposal) return { ok: false, error: "La propuesta de endoso no existe." };
  if (isProposalLocked(proposal.status)) {
    return {
      ok: false,
      error: "La propuesta está bloqueada. Reábrela para editarla.",
    };
  }

  await db.proposal.update({
    where: { id: proposalId },
    data: {
      endorsementType: data.type,
      endorsementDetail: data.detail,
      startDate: effective,
      endDate: toDate(data.endDate),
      observations: toNullable(data.observations),
    },
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "PROPOSAL",
    entityId: proposalId,
    action: "updated",
    summary: `Propuesta de endoso ${proposal.proposalNumber} actualizada`,
    userId: ctx.userId,
  });
  revalidatePath("/propuestas");
  revalidatePath(`/propuestas/${proposalId}`);
  return { ok: true, data: { id: proposalId } };
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

  // Si movía el estado y es el último endoso de ese tipo, revertir la póliza.
  if (endorsementStatusEffect(endorsement.type)) {
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
