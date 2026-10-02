import "server-only";
import type { PolicyStatus } from "@prisma/client";
import {
  HIDDEN_FROM_CARTERA,
  isPreIssuePolicy,
} from "@/lib/domain/policy-lifecycle";

export { HIDDEN_FROM_CARTERA, isPreIssuePolicy };

export function policyStatusFromProposal(status: string): PolicyStatus | null {
  switch (status) {
    case "ELABORACION":
    case "POR_ENVIAR":
    case "DEVUELTA":
      return "BORRADOR";
    case "ENVIADA_COMPANIA":
      return "ENVIADA";
    case "POR_DESPACHAR":
      return "POR_DESPACHAR";
    case "RECHAZADA":
      return "RECHAZADA";
    case "DESCARTADA":
      return "DESCARTADA";
    default:
      return null;
  }
}

type Tx = {
  // El cliente extendido no cabe en Prisma.TransactionClient.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

/**
 * Crea o actualiza la única póliza de una propuesta de póliza.
 * Una propuesta de endoso no abre otra fila. Una póliza ya en cartera
 * no se reescribe desde el borrador.
 */
export async function ensureDraftPolicy(
  tx: Tx,
  input: {
    organizationId: string;
    userId: string;
    proposalId: string;
    policyNumber?: string | null;
    status?: PolicyStatus | null;
  },
): Promise<string | null> {
  const proposal = await tx.proposal.findFirst({
    where: { id: input.proposalId },
    select: {
      id: true,
      kind: true,
      proposalNumber: true,
      status: true,
      clientId: true,
      companyId: true,
      lineId: true,
      branchId: true,
      productId: true,
      currency: true,
      startDate: true,
      endDate: true,
      premiumNet: true,
      commissionAffectPct: true,
      commissionExemptPct: true,
      assignedUserId: true,
      salespersonId: true,
      previousPolicyId: true,
    },
  });
  if (!proposal || proposal.kind === "ENDOSO") return null;

  const nextStatus =
    input.status ?? policyStatusFromProposal(proposal.status) ?? "BORRADOR";
  const existing = await tx.policy.findFirst({
    where: { proposalId: proposal.id },
    select: { id: true, status: true, policyNumber: true, lineageId: true },
  });
  if (existing && !isPreIssuePolicy(existing.status)) return existing.id;

  const requestedNumber = input.policyNumber?.trim() || null;
  const preferred = requestedNumber || proposal.proposalNumber;
  const number = await freePolicyNumber(tx, preferred, existing?.id, proposal.id);
  const shared = {
    clientId: proposal.clientId,
    companyId: proposal.companyId,
    lineId: proposal.lineId,
    branchId: proposal.branchId,
    productId: proposal.productId,
    currency: proposal.currency,
    startDate: proposal.startDate,
    endDate: proposal.endDate,
    premiumNet: proposal.premiumNet,
    commissionAffectPct: proposal.commissionAffectPct,
    commissionExemptPct: proposal.commissionExemptPct,
    assignedUserId: proposal.assignedUserId,
    salespersonId: proposal.salespersonId,
    previousPolicyId: proposal.previousPolicyId,
    status: nextStatus,
  };

  if (!existing) {
    const created = await tx.policy.create({
      data: {
        organizationId: input.organizationId,
        proposalId: proposal.id,
        policyNumber: number,
        createdById: input.userId,
        ...shared,
      },
      select: { id: true },
    });
    const chain = await lineageFor(tx, created.id, proposal.previousPolicyId);
    await tx.policy.update({
      where: { id: created.id },
      data: chain,
    });
    await tx.policyStatusHistory.create({
      data: {
        organizationId: input.organizationId,
        policyId: created.id,
        status: nextStatus,
        note: `Póliza abierta con la propuesta ${proposal.proposalNumber}`,
        changedById: input.userId,
      },
    });
    return created.id;
  }

  const keepNumber =
    !requestedNumber &&
    !existing.policyNumber.startsWith("DRAFT-") &&
    existing.policyNumber !== proposal.proposalNumber;
  await tx.policy.update({
    where: { id: existing.id },
    data: {
      ...shared,
      ...(keepNumber ? {} : { policyNumber: number }),
    },
  });
  if (!existing.lineageId) {
    const chain = await lineageFor(tx, existing.id, proposal.previousPolicyId);
    await tx.policy.update({ where: { id: existing.id }, data: chain });
  }
  if (existing.status !== nextStatus) {
    await tx.policyStatusHistory.create({
      data: {
        organizationId: input.organizationId,
        policyId: existing.id,
        status: nextStatus,
        note: `Sigue a la propuesta ${proposal.proposalNumber}`,
        changedById: input.userId,
      },
    });
  }
  return existing.id;
}

async function freePolicyNumber(
  tx: Tx,
  preferred: string,
  exceptId: string | undefined,
  proposalId: string,
): Promise<string> {
  const taken = await tx.policy.findFirst({
    where: {
      policyNumber: preferred,
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (!taken) return preferred;
  return `${preferred}-${proposalId.slice(-6)}`;
}

async function lineageFor(
  tx: Tx,
  policyId: string,
  previousPolicyId: string | null,
): Promise<{ lineageId: string; termNumber: number }> {
  if (!previousPolicyId) return { lineageId: policyId, termNumber: 1 };
  const mother = await tx.policy.findFirst({
    where: { id: previousPolicyId },
    select: { id: true, lineageId: true, termNumber: true },
  });
  if (!mother) return { lineageId: policyId, termNumber: 1 };
  if (!mother.lineageId) {
    await tx.policy.update({
      where: { id: mother.id },
      data: { lineageId: mother.id, termNumber: mother.termNumber ?? 1 },
    });
  }
  return {
    lineageId: mother.lineageId ?? mother.id,
    termNumber: (mother.termNumber ?? 1) + 1,
  };
}
