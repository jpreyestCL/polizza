import { setTenantGuc } from "@/server/tenant-rls";

// El cliente de transacción extendido no es asignable a un tipo propio.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SubmissionClient = any;

function text(value: { toString(): string } | null): string | null {
  return value == null ? null : value.toString();
}

function day(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/**
 * Guarda una foto inmutable del expediente en el momento del envío.
 * La propuesta sigue siendo editable; este registro no se reescribe.
 */
export async function recordPolicySubmission(
  tx: SubmissionClient,
  args: {
    organizationId: string;
    proposalId: string;
    sentAt: Date;
    createdById: string | null;
  },
): Promise<void> {
  await setTenantGuc(tx, args.organizationId);
  const proposal = await tx.proposal.findFirst({
    where: { id: args.proposalId },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { coverages: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!proposal) return;
  const last = await tx.policySubmission.findFirst({
    where: { proposalId: args.proposalId },
    orderBy: { seqNo: "desc" },
    select: { seqNo: true },
  });
  const snapshot = {
    proposalNumber: proposal.proposalNumber,
    kind: proposal.kind,
    status: proposal.status,
    clientId: proposal.clientId,
    companyId: proposal.companyId,
    currency: proposal.currency,
    startDate: day(proposal.startDate),
    endDate: day(proposal.endDate),
    premiumNet: text(proposal.premiumNet),
    items: proposal.items.map((item: {
      order: number;
      identification: string | null;
      data: unknown;
      coverages: {
        name: string;
        premiumAffect: { toString(): string } | null;
        premiumExempt: { toString(): string } | null;
        premiumNet: { toString(): string } | null;
        deductibleText: string | null;
        deductibleAmount: { toString(): string } | null;
        deductiblePct: { toString(): string } | null;
        deductibleMinimum: { toString(): string } | null;
      }[];
    }) => ({
      order: item.order,
      identification: item.identification,
      data: item.data,
      coverages: item.coverages.map((coverage) => ({
        name: coverage.name,
        premiumAffect: text(coverage.premiumAffect),
        premiumExempt: text(coverage.premiumExempt),
        premiumNet: text(coverage.premiumNet),
        deductibleText: coverage.deductibleText,
        deductibleAmount: text(coverage.deductibleAmount),
        deductiblePct: text(coverage.deductiblePct),
        deductibleMinimum: text(coverage.deductibleMinimum),
      })),
    })),
  };
  await tx.policySubmission.create({
    data: {
      organizationId: args.organizationId,
      proposalId: args.proposalId,
      seqNo: (last?.seqNo ?? 0) + 1,
      sentAt: args.sentAt,
      snapshot,
      createdById: args.createdById,
    },
  });
}
