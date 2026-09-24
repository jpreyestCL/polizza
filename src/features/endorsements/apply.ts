import "server-only";
import type { EndorsementType } from "@prisma/client";
import {
  ENDORSEMENT_TYPE_LABELS,
  endorsementStatusEffect,
  endorsementTransitionError,
} from "./schemas";

export type ApplyEndorsementInput = {
  organizationId: string;
  userId: string;
  policyId: string;
  type: EndorsementType;
  effectiveDate: Date;
  endDate: Date | null;
  endorsementNumber: string | null;
  detail: string | null;
  notes: string | null;
  /** Propuesta de endoso que lo origina (null = registro directo). */
  proposalId: string | null;
};

/**
 * Registra un endoso en la póliza y aplica su efecto sobre el estado
 * (cancelación / anulación). Se usa tanto en el registro directo como al
 * despachar una propuesta de endoso. Debe correr dentro de una transacción.
 */
// El tx del cliente extendido (`getDb`) no es asignable a
// Prisma.TransactionClient; mismo criterio que replaceParticipations.
export async function applyEndorsementToPolicy(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  input: ApplyEndorsementInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const policy = (await tx.policy.findFirst({
    where: { id: input.policyId },
    select: { id: true, status: true },
  })) as { id: string; status: string } | null;
  if (!policy) return { ok: false, error: "La póliza no existe." };

  const transitionError = endorsementTransitionError(input.type, policy.status);
  if (transitionError) return { ok: false, error: transitionError };

  const created = (await tx.endorsement.create({
    data: {
      organizationId: input.organizationId,
      policyId: input.policyId,
      type: input.type,
      effectiveDate: input.effectiveDate,
      endDate: input.endDate,
      endorsementNumber: input.endorsementNumber,
      detail: input.detail,
      notes: input.notes,
      proposalId: input.proposalId,
      createdById: input.userId,
    },
    select: { id: true },
  })) as { id: string };

  const nextStatus = endorsementStatusEffect(input.type);
  if (nextStatus) {
    await tx.policy.update({
      where: { id: input.policyId },
      data: { status: nextStatus },
    });
    await tx.policyStatusHistory.create({
      data: {
        organizationId: input.organizationId,
        policyId: input.policyId,
        status: nextStatus,
        note: `Endoso de ${ENDORSEMENT_TYPE_LABELS[input.type].toLowerCase()}${
          input.endorsementNumber ? ` N° ${input.endorsementNumber}` : ""
        }`,
        changedById: input.userId,
      },
    });
  }
  return { ok: true, id: created.id };
}
