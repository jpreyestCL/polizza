import "server-only";
import type { ClaimStatus, PolicyStatus } from "@prisma/client";
import type { SessionContext } from "@/server/context";
import { basePrisma, type Db } from "@/server/db";
import { canSeeAllClients } from "@/lib/roles";

export type ClaimListItem = {
  id: string;
  claimNumber: string;
  folderNumber: number;
  companyClaimNumber: string | null;
  status: ClaimStatus;
  description: string;
  occurredAt: Date | null;
  reportedAtBroker: Date | null;
  estimatedAmount: number | null;
  settledAmount: number | null;
  currency: string;
  clientId: string;
  policyId: string | null;
  branchTypeKey: string | null;
  branchTypeName: string | null;
  assignedUserId: string | null;
  createdAt: Date;
  client: { id: string; name: string };
  policy: { id: string; policyNumber: string } | null;
};

/** Siniestros acotados por rol. */
export async function listClaims(
  ctx: SessionContext,
  db: Db,
): Promise<ClaimListItem[]> {
  const rows = await db.claim.findMany({
    where: canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      claimNumber: true,
      folderNumber: true,
      companyClaimNumber: true,
      status: true,
      description: true,
      occurredAt: true,
      reportedAtBroker: true,
      estimatedAmount: true,
      settledAmount: true,
      currency: true,
      clientId: true,
      policyId: true,
      assignedUserId: true,
      createdAt: true,
      client: { select: { id: true, name: true } },
      branchType: { select: { key: true, name: true } },
    },
  });

  const policyIds = Array.from(
    new Set(rows.map((r) => r.policyId).filter((id): id is string => !!id)),
  );
  const policies = policyIds.length
    ? await db.policy.findMany({
        where: { id: { in: policyIds } },
        select: { id: true, policyNumber: true },
      })
    : [];
  const policyMap = new Map(policies.map((p) => [p.id, p]));

  return rows.map((claim) => ({
    id: claim.id,
    claimNumber: claim.claimNumber,
    folderNumber: claim.folderNumber,
    companyClaimNumber: claim.companyClaimNumber,
    status: claim.status,
    description: claim.description,
    occurredAt: claim.occurredAt,
    reportedAtBroker: claim.reportedAtBroker,
    estimatedAmount: claim.estimatedAmount
      ? Number(claim.estimatedAmount)
      : null,
    settledAmount: claim.settledAmount ? Number(claim.settledAmount) : null,
    currency: claim.currency,
    clientId: claim.clientId,
    policyId: claim.policyId,
    branchTypeKey: claim.branchType?.key ?? null,
    branchTypeName: claim.branchType?.name ?? null,
    assignedUserId: claim.assignedUserId,
    createdAt: claim.createdAt,
    client: claim.client,
    policy: claim.policyId
      ? (policyMap.get(claim.policyId) ?? null)
      : null,
  }));
}

/** Detalle de un siniestro con todo lo necesario para la ficha. */
export async function getClaimDetail(db: Db, id: string) {
  const claim = await db.claim.findFirst({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          rut: true,
          type: true,
          phone: true,
          celular: true,
          email: true,
        },
      },
      branchType: { select: { id: true, key: true, name: true } },
      policyItem: {
        select: {
          id: true,
          description: true,
          insuredAmount: true,
          currency: true,
        },
      },
      proposalItem: {
        select: {
          id: true,
          identification: true,
          glossNote: true,
          data: true,
          insuredClientId: true,
          beneficiaryClientId: true,
          branchType: { select: { key: true, name: true } },
        },
      },
      statusHistory: { orderBy: { createdAt: "desc" } },
      thirdParties: { orderBy: { createdAt: "asc" } },
      logs: { orderBy: { createdAt: "desc" }, take: 200 },
    },
  });
  if (!claim) return null;

  // Datos de contratante / asegurado / beneficiario
  let policy: {
    id: string;
    policyNumber: string;
    branchId: string | null;
    companyId: string | null;
    startDate: Date | null;
    endDate: Date | null;
    status: PolicyStatus;
    proposalId: string | null;
    items: { id: string; description: string; insuredAmount: number | null; currency: string }[];
  } | null = null;
  if (claim.policyId) {
    const p = await db.policy.findFirst({
      where: { id: claim.policyId },
      select: {
        id: true,
        policyNumber: true,
        branchId: true,
        companyId: true,
        startDate: true,
        endDate: true,
        status: true,
        proposalId: true,
        items: {
          select: {
            id: true,
            description: true,
            insuredAmount: true,
            currency: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (p) {
      policy = {
        ...p,
        items: p.items.map((it) => ({
          ...it,
          insuredAmount: it.insuredAmount ? Number(it.insuredAmount) : null,
        })),
      };
    }
  }

  const insured = claim.proposalItem?.insuredClientId
    ? await db.client.findFirst({
        where: { id: claim.proposalItem.insuredClientId },
        select: { id: true, name: true, rut: true, email: true, phone: true, celular: true },
      })
    : null;
  const beneficiary = claim.proposalItem?.beneficiaryClientId
    ? await db.client.findFirst({
        where: { id: claim.proposalItem.beneficiaryClientId },
        select: { id: true, name: true, rut: true, email: true, phone: true, celular: true },
      })
    : null;

  return {
    ...claim,
    estimatedAmount: claim.estimatedAmount
      ? Number(claim.estimatedAmount)
      : null,
    settledAmount: claim.settledAmount ? Number(claim.settledAmount) : null,
    policy,
    insuredClient: insured,
    beneficiaryClient: beneficiary,
    policyItemAmount: claim.policyItem?.insuredAmount
      ? Number(claim.policyItem.insuredAmount)
      : null,
  };
}

export type ClaimDetail = NonNullable<
  Awaited<ReturnType<typeof getClaimDetail>>
>;

/** Siniestros de un cliente, para la ficha 360°. */
export async function listClientClaims(db: Db, clientId: string) {
  return db.claim.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      claimNumber: true,
      status: true,
      occurredAt: true,
    },
  });
}

/** Bitácora cruzada (ActivityLog + ClaimLog). */
export async function getClaimActivity(db: Db, claimId: string) {
  return db.activityLog.findMany({
    where: { entityType: "CLAIM", entityId: claimId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/** Helper para resolver una póliza por número o por cliente/RUT. */
export type PolicySearchResult = {
  id: string;
  policyNumber: string;
  status: PolicyStatus;
  startDate: Date | null;
  endDate: Date | null;
  client: { id: string; name: string; rut: string };
};

/**
 * Busca pólizas por número exacto, número de cliente o RUT/nombre del cliente.
 * Permite filtrar por estado vigente/no vigente.
 */
export async function searchPoliciesForClaim(
  ctx: SessionContext,
  db: Db,
  options: {
    query: string;
    includeNonActive: boolean;
  },
): Promise<PolicySearchResult[]> {
  const q = options.query.trim();
  if (!q) return [];

  const statusFilter = options.includeNonActive
    ? undefined
    : { status: "VIGENTE" as PolicyStatus };
  const roleFilter = canSeeAllClients(ctx.role)
    ? {}
    : { assignedUserId: ctx.userId };

  const policies = await db.policy.findMany({
    where: {
      ...statusFilter,
      ...roleFilter,
      OR: [
        { policyNumber: { contains: q, mode: "insensitive" } },
        {
          client: {
            OR: [
              { rut: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { firstName: { contains: q, mode: "insensitive" } },
              { lastNamePaterno: { contains: q, mode: "insensitive" } },
              { lastNameMaterno: { contains: q, mode: "insensitive" } },
              { legalName: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      policyNumber: true,
      status: true,
      startDate: true,
      endDate: true,
      client: { select: { id: true, name: true, rut: true } },
    },
  });

  return policies;
}

/**
 * Ítems de una póliza, incluyendo el ítem rico de la propuesta original
 * cuando exista (para poder mostrar el ramo y la ficha completa).
 */
export async function getPolicyItemsForClaim(db: Db, policyId: string) {
  const policy = await db.policy.findFirst({
    where: { id: policyId },
    select: {
      id: true,
      policyNumber: true,
      proposalId: true,
      clientId: true,
      branchId: true,
      items: {
        select: {
          id: true,
          description: true,
          insuredAmount: true,
          currency: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!policy) return null;

  const proposalItems = policy.proposalId
    ? await db.proposalItem.findMany({
        where: { proposalId: policy.proposalId },
        orderBy: { order: "asc" },
        select: {
          id: true,
          identification: true,
          branchTypeId: true,
          branchType: { select: { id: true, key: true, name: true } },
          insuredClientId: true,
          beneficiaryClientId: true,
        },
      })
    : [];

  const items = policy.items.map((it, idx) => ({
    ...it,
    insuredAmount: it.insuredAmount ? Number(it.insuredAmount) : null,
    proposalItem: proposalItems[idx] ?? null,
  }));

  return { ...policy, items };
}

/** Definición de campos por ramo, para renderizar la ficha dinámica. */
export type BranchFieldDef = {
  fieldKey: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "richtext";
  required: boolean;
  options: { value: string; label: string }[] | null;
  helpText: string | null;
};

export async function getBranchFieldSchema(
  branchTypeId: string,
): Promise<BranchFieldDef[]> {
  const rows = await basePrisma.branchFieldSchema.findMany({
    where: { branchTypeId },
    orderBy: { order: "asc" },
  });
  return rows.map((r) => ({
    fieldKey: r.fieldKey,
    label: r.label,
    type: r.type as BranchFieldDef["type"],
    required: r.required,
    options: (r.options as { value: string; label: string }[] | null) ?? null,
    helpText: r.helpText,
  }));
}
