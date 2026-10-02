import "server-only";
import type { EndorsementType } from "@prisma/client";
import type { Db } from "@/server/db";
import {
  deriveRenewalStatus,
  type PolicyStatusCode,
  type RenewalStatus,
} from "@/lib/domain/renewal-status";
import { calendarDaysBetween } from "@/lib/domain/term";
import { renewalRisk, type RenewalRisk } from "@/lib/domain/renewal-status";
import { successorState, successorWasSent } from "@/lib/domain/successor";

export type RenewalSource = {
  id: string;
  status: PolicyStatusCode;
  endDate: Date | null;
  notRenewable: boolean;
  nonRenewalAt: Date | null;
  productRenewable: boolean | null;
};

export type RenewalView = {
  status: RenewalStatus;
  quoting: boolean;
  risk: RenewalRisk | null;
};

const CANCEL_TYPES: EndorsementType[] = [
  "CANCELACION_COMPANIA",
  "CANCELACION_NO_PAGO",
  "SOLICITUD_CANCELACION",
];

export async function renewalStatusByPolicy(
  db: Db,
  rows: RenewalSource[],
  now: Date = new Date(),
): Promise<Map<string, RenewalView>> {
  const ids = rows.map((row) => row.id);
  const result = new Map<string, RenewalView>();
  if (ids.length === 0) return result;

  const [children, proposals, quotes] = await Promise.all([
    db.policy.findMany({
      where: { previousPolicyId: { in: ids } },
      select: { id: true, previousPolicyId: true, status: true, startDate: true },
    }),
    db.proposal.findMany({
      where: { previousPolicyId: { in: ids }, kind: "POLIZA" },
      select: { previousPolicyId: true, status: true },
    }),
    db.quoteRequest.findMany({
      where: {
        sourcePolicyId: { in: ids },
        origin: "RENEWAL",
        status: { in: ["BORRADOR", "SOLICITADA", "COTIZADA", "ENVIADA_CLIENTE"] },
      },
      select: { sourcePolicyId: true },
    }),
  ]);

  const childIds = children.map((child) => child.id);
  const cancellations =
    childIds.length === 0
      ? []
      : await db.endorsement.findMany({
          where: { policyId: { in: childIds }, type: { in: CANCEL_TYPES } },
          select: { policyId: true, effectiveDate: true },
        });
  const cancelOn = new Map<string, Date>();
  for (const endorsement of cancellations) {
    const current = cancelOn.get(endorsement.policyId);
    if (!current || endorsement.effectiveDate < current) {
      cancelOn.set(endorsement.policyId, endorsement.effectiveDate);
    }
  }

  const childStatuses = new Map<string, string[]>();
  const cancelledAfterStart = new Set<string>();
  for (const child of children) {
    if (!child.previousPolicyId) continue;
    const list = childStatuses.get(child.previousPolicyId) ?? [];
    list.push(child.status);
    childStatuses.set(child.previousPolicyId, list);
    const effective = cancelOn.get(child.id);
    if (
      child.status === "CANCELADA" &&
      child.startDate &&
      effective &&
      calendarDaysBetween(child.startDate, effective) > 0
    ) {
      cancelledAfterStart.add(child.previousPolicyId);
    }
  }
  const proposalStatuses = new Map<string, string[]>();
  for (const proposal of proposals) {
    if (!proposal.previousPolicyId) continue;
    const list = proposalStatuses.get(proposal.previousPolicyId) ?? [];
    list.push(proposal.status);
    proposalStatuses.set(proposal.previousPolicyId, list);
  }
  const quoting = new Set(
    quotes.map((quote) => quote.sourcePolicyId).filter((id): id is string => !!id),
  );

  for (const row of rows) {
    const proposalsOf = proposalStatuses.get(row.id) ?? [];
    const status = deriveRenewalStatus({
      policyStatus: row.status,
      endDate: row.endDate,
      notRenewable: row.notRenewable || row.productRenewable === false,
      nonRenewalRecorded: row.nonRenewalAt != null,
      successor: successorState({
        childStatuses: childStatuses.get(row.id) ?? [],
        proposalStatuses: proposalsOf,
        cancelledAfterStart: cancelledAfterStart.has(row.id),
      }),
      now,
    });
    const daysToEnd = row.endDate ? calendarDaysBetween(now, row.endDate) : null;
    result.set(row.id, {
      status,
      quoting: quoting.has(row.id) && status === "PENDING",
      risk: renewalRisk({
        status,
        daysToEnd,
        successorSent: successorWasSent(proposalsOf),
      }),
    });
  }
  return result;
}
