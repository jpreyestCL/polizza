import "server-only";
import type { ProposalStatus } from "@prisma/client";
import type { SessionContext } from "@/server/context";
import { basePrisma, type Db } from "@/server/db";
import { canSeeAllClients } from "@/lib/roles";
import { proposalSla, type SlaLevel } from "./sla";

export type ProposalListItem = {
  id: string;
  proposalNumber: string;
  status: ProposalStatus;
  premiumNet: number | null;
  currency: string;
  startDate: Date | null;
  endDate: Date | null;
  companyId: string | null;
  lineId: string | null;
  assignedUserId: string | null;
  currentStateStartedAt: Date;
  createdAt: Date;
  client: { id: string; name: string };
  daysInState: number;
  slaLevel: SlaLevel;
};

/** Propuestas para Kanban y lista, acotadas por rol y con SLA calculado. */
export async function listProposals(
  ctx: SessionContext,
  db: Db,
  holidays: Set<string>,
): Promise<ProposalListItem[]> {
  const rows = await db.proposal.findMany({
    where: canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      proposalNumber: true,
      status: true,
      premiumNet: true,
      currency: true,
      startDate: true,
      endDate: true,
      companyId: true,
      lineId: true,
      assignedUserId: true,
      currentStateStartedAt: true,
      createdAt: true,
      client: { select: { id: true, name: true } },
    },
  });

  return rows.map((p) => {
    const sla = proposalSla(p.status, p.currentStateStartedAt, holidays);
    return {
      ...p,
      premiumNet: p.premiumNet ? Number(p.premiumNet) : null,
      daysInState: sla.daysInState,
      slaLevel: sla.level,
    };
  });
}

/** Detalle de una propuesta con cliente, ramo (BranchType) e historial. */
export async function getProposalDetail(db: Db, id: string) {
  const proposal = await db.proposal.findFirst({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          rut: true,
          comentarioAlerta: true,
        },
      },
      branchType: { select: { id: true, name: true } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!proposal) return null;
  return {
    ...proposal,
    pdfBytes: undefined, // No filtramos los bytes hacia el cliente.
    hasStoredPdf: Boolean(proposal.pdfBytes),
    premiumNet: proposal.premiumNet ? Number(proposal.premiumNet) : null,
    premiumGross: proposal.premiumGross
      ? Number(proposal.premiumGross)
      : null,
    commissionAffectPct: proposal.commissionAffectPct
      ? Number(proposal.commissionAffectPct)
      : null,
    commissionExemptPct: proposal.commissionExemptPct
      ? Number(proposal.commissionExemptPct)
      : null,
  };
}

/** Suma las primas de todas las coberturas de una propuesta. */
export async function getProposalPremiumTotals(db: Db, proposalId: string) {
  const items = await db.proposalItem.findMany({
    where: { proposalId },
    select: {
      coverages: {
        select: {
          premiumAffect: true,
          premiumExempt: true,
          premiumNet: true,
          ivaAmount: true,
          premiumGross: true,
        },
      },
    },
  });
  let affect = 0;
  let exempt = 0;
  let net = 0;
  for (const it of items) {
    for (const c of it.coverages) {
      if (c.premiumAffect) affect += Number(c.premiumAffect);
      if (c.premiumExempt) exempt += Number(c.premiumExempt);
      if (c.premiumNet) net += Number(c.premiumNet);
    }
  }
  // IVA del resumen = 19% × prima afecta total de todos los ítems.
  const iva = affect * 0.19;
  const gross = affect + exempt + iva;
  return { affect, exempt, net, iva, gross };
}

export type ProposalDetail = NonNullable<
  Awaited<ReturnType<typeof getProposalDetail>>
>;

/** Propuestas de un cliente, para la ficha 360°. */
export async function listClientProposals(db: Db, clientId: string) {
  return db.proposal.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      proposalNumber: true,
      status: true,
      createdAt: true,
    },
  });
}

/** Bitácora de actividad de una propuesta. */
export async function getProposalActivity(db: Db, proposalId: string) {
  return db.activityLog.findMany({
    where: { entityType: "PROPOSAL", entityId: proposalId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

// ─── Datos para el formulario v2 de propuesta ────────────────────────

export type ProposalFormCatalog = {
  companies: {
    id: string;
    name: string;
    isLife: boolean;
    defaultEmail: string | null;
    contacts: { id: string; name: string; email: string | null; isDefault: boolean }[];
  }[];
  products: {
    id: string;
    name: string;
    insuranceCompanyId: string;
    branchTypeId: string | null;
    commissionAffectPct: number | null;
    commissionExemptPct: number | null;
  }[];
  branches: { id: string; name: string; category: string }[];
  policies: {
    id: string;
    policyNumber: string;
    clientId: string;
    clientName: string;
  }[];
  quotations: {
    id: string;
    quotationNumber: string;
    clientId: string;
  }[];
};

/** Catálogos necesarios para el formulario v2 (compañías, productos, ramos, pólizas, cotizaciones). */
export async function getProposalFormCatalog(
  db: Db,
): Promise<ProposalFormCatalog> {
  const [companies, products, branches, policies, quotations] = await Promise.all([
    db.insuranceCompany.findMany({
      where: { status: "ACTIVA" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        isLife: true,
        defaultEmail: true,
        globalCompany: { select: { name: true, isLife: true } },
        contacts: {
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          select: { id: true, name: true, email: true, isDefault: true },
        },
      },
    }),
    db.insuranceProduct.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        insuranceCompanyId: true,
        branchTypeId: true,
        commissionAffectPct: true,
        commissionExemptPct: true,
      },
    }),
    basePrisma.branchType.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true, category: true },
    }),
    db.policy.findMany({
      where: { status: { in: ["VIGENTE", "VENCIDA"] } },
      orderBy: { policyNumber: "asc" },
      take: 200,
      select: {
        id: true,
        policyNumber: true,
        clientId: true,
        client: { select: { name: true } },
      },
    }),
    db.carQuotation.findMany({
      where: { status: "COMPLETADA" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, quotationNumber: true, clientId: true },
    }),
  ]);

  return {
    companies: companies.map((c) => ({
      id: c.id,
      name: c.globalCompany?.name ?? c.name,
      isLife: c.globalCompany?.isLife ?? c.isLife,
      defaultEmail: c.defaultEmail,
      contacts: c.contacts,
    })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      insuranceCompanyId: p.insuranceCompanyId,
      branchTypeId: p.branchTypeId,
      commissionAffectPct: p.commissionAffectPct ? Number(p.commissionAffectPct) : null,
      commissionExemptPct: p.commissionExemptPct ? Number(p.commissionExemptPct) : null,
    })),
    branches: branches.map((b) => ({ id: b.id, name: b.name, category: b.category })),
    policies: policies.map((p) => ({
      id: p.id,
      policyNumber: p.policyNumber,
      clientId: p.clientId,
      clientName: p.client.name,
    })),
    quotations,
  };
}
