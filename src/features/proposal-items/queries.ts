import "server-only";
import { basePrisma, type Db } from "@/server/db";
import { migrateItemData } from "@/lib/item-data-migration";

import type { ItemCoverageRow } from "@/features/proposal-coverages/queries";

export type ProposalItemRow = {
  id: string;
  order: number;
  branchTypeId: string;
  branchTypeKey: string;
  branchTypeName: string;
  insuredClientId: string | null;
  insuredClientName: string | null;
  insuredClientRut: string | null;
  beneficiaryClientId: string | null;
  beneficiaryClientName: string | null;
  beneficiaryClientRut: string | null;
  identification: string | null;
  glossNote: string | null;
  data: Record<string, unknown>;
  coveragesCount: number;
  totalNetPremium: number;
  coverages: ItemCoverageRow[];
};

export async function listProposalItems(
  db: Db,
  proposalId: string,
): Promise<ProposalItemRow[]> {
  const rows = await db.proposalItem.findMany({
    where: { proposalId },
    orderBy: { order: "asc" },
    include: {
      branchType: { select: { key: true, name: true } },
      coverages: { orderBy: { order: "asc" } },
    },
  });
  // Map insured/beneficiary names + ruts
  const clientIds = new Set<string>();
  for (const r of rows) {
    if (r.insuredClientId) clientIds.add(r.insuredClientId);
    if (r.beneficiaryClientId) clientIds.add(r.beneficiaryClientId);
  }
  const clients = clientIds.size
    ? await db.client.findMany({
        where: { id: { in: Array.from(clientIds) } },
        select: { id: true, name: true, rut: true },
      })
    : [];
  const clientMap = new Map(
    clients.map((c) => [c.id, { name: c.name, rut: c.rut ?? null }]),
  );
  return rows.map((r) => ({
    id: r.id,
    order: r.order,
    branchTypeId: r.branchTypeId,
    branchTypeKey: r.branchType.key,
    branchTypeName: r.branchType.name,
    insuredClientId: r.insuredClientId,
    insuredClientName: r.insuredClientId
      ? (clientMap.get(r.insuredClientId)?.name ?? null)
      : null,
    insuredClientRut: r.insuredClientId
      ? (clientMap.get(r.insuredClientId)?.rut ?? null)
      : null,
    beneficiaryClientId: r.beneficiaryClientId,
    beneficiaryClientName: r.beneficiaryClientId
      ? (clientMap.get(r.beneficiaryClientId)?.name ?? null)
      : null,
    beneficiaryClientRut: r.beneficiaryClientId
      ? (clientMap.get(r.beneficiaryClientId)?.rut ?? null)
      : null,
    identification: r.identification,
    glossNote: r.glossNote,
    data: migrateItemData(r.data, r.dataSchemaVersion).data,
    coveragesCount: r.coverages.length,
    totalNetPremium: r.coverages.reduce(
      (sum, c) => sum + (c.premiumNet ? Number(c.premiumNet) : 0),
      0,
    ),
    coverages: r.coverages.map(
      (c): ItemCoverageRow => ({
        id: c.id,
        order: c.order,
        name: c.name,
        polCad: c.polCad,
        type: c.type,
        isCommercialValue: c.isCommercialValue,
        insuredAmount: c.insuredAmount ? Number(c.insuredAmount) : null,
        insuredCurrency: c.insuredCurrency,
        affectedByIva: c.affectedByIva,
        taxRateAffect: c.taxRateAffect ? Number(c.taxRateAffect) : null,
        taxRateExempt: c.taxRateExempt ? Number(c.taxRateExempt) : null,
        premiumAffect: c.premiumAffect ? Number(c.premiumAffect) : null,
        premiumExempt: c.premiumExempt ? Number(c.premiumExempt) : null,
        premiumNet: c.premiumNet ? Number(c.premiumNet) : null,
        ivaAmount: c.ivaAmount ? Number(c.ivaAmount) : null,
        premiumGross: c.premiumGross ? Number(c.premiumGross) : null,
        commissionAffectPct: c.commissionAffectPct
          ? Number(c.commissionAffectPct)
          : null,
        commissionExemptPct: c.commissionExemptPct
          ? Number(c.commissionExemptPct)
          : null,
        commissionAmount: c.commissionAmount
          ? Number(c.commissionAmount)
          : null,
        sumsToTotal: c.sumsToTotal,
        manualPremium: c.manualPremium,
        autoLoaded: c.autoLoaded,
      }),
    ),
  }));
}

export type BranchFieldDef = {
  id: string;
  fieldKey: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "richtext";
  required: boolean;
  order: number;
  options: { value: string; label: string }[] | null;
  helpText: string | null;
};

export async function getBranchFieldSchemas(
  branchTypeId: string,
): Promise<BranchFieldDef[]> {
  const rows = await basePrisma.branchFieldSchema.findMany({
    where: { branchTypeId },
    orderBy: { order: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    fieldKey: r.fieldKey,
    label: r.label,
    type: r.type as BranchFieldDef["type"],
    required: r.required,
    order: r.order,
    options: r.options as { value: string; label: string }[] | null,
    helpText: r.helpText,
  }));
}

/** Lista los ítems de propuesta con sus coberturas detalladas (para PDF y UI completa). */
export async function getProposalItemsWithCoverages(
  db: Db,
  proposalId: string,
) {
  const rows = await db.proposalItem.findMany({
    where: { proposalId },
    orderBy: { order: "asc" },
    include: {
      branchType: { select: { name: true } },
      coverages: { orderBy: { order: "asc" } },
    },
  });
  // Aplicar migración de `data` al leer.
  return rows.map((r) => ({
    ...r,
    data: migrateItemData(r.data, r.dataSchemaVersion).data,
  }));
}
