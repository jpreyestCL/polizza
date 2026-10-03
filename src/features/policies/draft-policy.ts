import "server-only";
import { Prisma, type PolicyStatus } from "@prisma/client";
import { parseDeductible } from "@/lib/domain/deductible";
import { setTenantGuc } from "@/server/tenant-rls";
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
    await syncPolicyMateria(tx, {
      organizationId: input.organizationId,
      proposalId: proposal.id,
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
  await syncPolicyMateria(tx, {
    organizationId: input.organizationId,
    proposalId: proposal.id,
  });
  return existing.id;
}

/**
 * Re-sincroniza la póliza borrador tras editar ítems, coberturas o plan.
 * La edición ya quedó guardada: si la sincronización falla no se le informa
 * error al usuario, se registra, y el siguiente cambio de estado de la
 * propuesta (que sincroniza dentro de su transacción) la pone al día.
 */
export async function refreshDraftPolicy(
  db: Tx,
  ctx: { organizationId: string; userId: string },
  proposalId: string,
): Promise<void> {
  try {
    await db.$transaction(async (tx: Tx) => {
      await setTenantGuc(tx as never, ctx.organizationId);
      await ensureDraftPolicy(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        proposalId,
      });
    });
  } catch (error) {
    console.error("[draft-policy] no se pudo sincronizar la póliza", {
      proposalId,
      error,
    });
  }
}

/**
 * Copia ítems y coberturas de la propuesta a su póliza y le cuelga el plan
 * de pago. Solo reescribe pólizas pre-emisión, salvo `force` (despacho).
 * Las cuotas pasan a la póliza al emitir: antes no se cobran.
 */
export async function syncPolicyMateria(
  tx: Tx,
  input: { organizationId: string; proposalId: string; force?: boolean },
): Promise<void> {
  const policy = await tx.policy.findFirst({
    where: { proposalId: input.proposalId },
    select: { id: true, status: true, currency: true },
  });
  if (!policy) return;
  if (!input.force && !isPreIssuePolicy(policy.status)) return;

  const items = await tx.proposalItem.findMany({
    where: { proposalId: input.proposalId },
    orderBy: { order: "asc" },
    include: {
      branchType: { select: { name: true } },
      coverages: { orderBy: { order: "asc" } },
    },
  });
  const mapped = policyMateriaFromItems(items, {
    organizationId: input.organizationId,
    policyId: policy.id,
    currency: policy.currency,
  });

  // Los ítems se actualizan en su lugar para no cambiarles el id: un siniestro
  // o un endoso puede apuntar a ellos. Los que agregó un endoso no se tocan.
  const current: { id: string }[] = await tx.policyItem.findMany({
    where: { policyId: policy.id, addedByEndorsementId: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  for (const [index, item] of mapped.items.entries()) {
    const target = current[index];
    if (target) {
      await tx.policyItem.update({
        where: { id: target.id },
        data: {
          description: item.description,
          insuredAmount: item.insuredAmount,
          currency: item.currency,
        },
      });
    } else {
      await tx.policyItem.create({ data: item });
    }
  }
  const surplus = current.slice(mapped.items.length).map((item) => item.id);
  if (surplus.length > 0) {
    await tx.policyItem.deleteMany({
      where: { id: { in: surplus }, claims: { none: {} } },
    });
  }
  await tx.policyCoverage.deleteMany({ where: { policyId: policy.id } });
  if (mapped.coverages.length > 0) {
    await tx.policyCoverage.createMany({ data: mapped.coverages });
  }

  const plan = await tx.paymentPlan.findFirst({
    where: { proposalId: input.proposalId },
    select: { id: true, policyId: true },
  });
  if (plan && plan.policyId !== policy.id) {
    await tx.paymentPlan.update({
      where: { id: plan.id },
      data: { policyId: policy.id },
    });
  }
}

type MateriaCoverage = {
  name: string;
  insuredAmount: Prisma.Decimal | null;
  sumsToTotal: boolean;
  deductibleText: string | null;
  deductibleAmount: Prisma.Decimal | null;
  deductiblePct: Prisma.Decimal | null;
  deductibleMinimum: Prisma.Decimal | null;
};

export function policyMateriaFromItems(
  items: Array<{
    identification: string | null;
    data: unknown;
    branchType: { name: string };
    coverages: MateriaCoverage[];
  }>,
  target: { organizationId: string; policyId: string; currency: string },
) {
  const dec = (value: number | null) =>
    value == null ? null : new Prisma.Decimal(value.toFixed(4));
  const policyItems = items.map((it) => {
    const itData = (it.data ?? {}) as Record<string, unknown>;
    const description =
      it.identification ??
      (typeof itData.patente === "string" ? itData.patente : null) ??
      (typeof itData.direccion === "string" ? itData.direccion : null) ??
      it.branchType.name;
    const insuredAmount = it.coverages
      .filter((c) => c.sumsToTotal)
      .reduce((s, c) => s + (c.insuredAmount ? Number(c.insuredAmount) : 0), 0);
    return {
      organizationId: target.organizationId,
      policyId: target.policyId,
      description,
      insuredAmount: insuredAmount > 0 ? new Prisma.Decimal(insuredAmount) : null,
      currency: target.currency,
    };
  });
  const coverages = items.flatMap((it) =>
    it.coverages.map((c) => {
      const parsed = parseDeductible(c.deductibleText);
      const hasStructured =
        c.deductibleAmount != null ||
        c.deductiblePct != null ||
        c.deductibleMinimum != null;
      return {
        organizationId: target.organizationId,
        policyId: target.policyId,
        name: c.name,
        insuredAmount: c.insuredAmount,
        currency: target.currency,
        deductible: hasStructured ? c.deductibleText : parsed.text,
        deductibleAmount: hasStructured ? c.deductibleAmount : dec(parsed.amount),
        deductiblePct: hasStructured ? c.deductiblePct : dec(parsed.pct),
        deductibleMinimum: hasStructured
          ? c.deductibleMinimum
          : dec(parsed.minimum),
      };
    }),
  );
  return { items: policyItems, coverages };
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
