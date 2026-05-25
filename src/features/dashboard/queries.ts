import "server-only";
import type { SessionContext } from "@/server/context";
import type { Db } from "@/server/db";
import {
  listAllProposalsForKanban,
  type ProposalListItem,
} from "@/features/proposals/queries";
import {
  listAllPoliciesForDashboard,
  listAllRenewalsForDashboard,
  type PolicyListItem,
} from "@/features/policies/queries";
import { listTasks, type TaskListItem } from "@/features/tasks/queries";
import { getHolidaySet } from "@/features/catalog/queries";
import type { SlaLevel } from "@/features/proposals/sla";

const ACTIVE_PROPOSAL_STATUSES = [
  "ELABORACION",
  "ENVIADA_COMPANIA",
  "DEVUELTA",
];

const SLA_RANK: Record<SlaLevel, number> = {
  critical: 2,
  warning: 1,
  none: 0,
};

export type DashboardActivity = {
  id: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: Date;
};

export type DashboardData = {
  metrics: {
    clients: number;
    activeProposals: number;
    vigentePolicies: number;
    renewals: number;
    openTasks: number;
  };
  slaProposals: ProposalListItem[];
  renewals: PolicyListItem[];
  overdueTasks: TaskListItem[];
  recentActivity: DashboardActivity[];
};

/** Datos agregados para el panel operativo de la corredora. */
export async function getDashboardData(
  ctx: SessionContext,
  db: Db,
): Promise<DashboardData> {
  const holidays = await getHolidaySet();
  const [clients, proposals, policies, renewals, tasks, recentActivity] =
    await Promise.all([
      db.client.count(),
      listAllProposalsForKanban(ctx, db, holidays),
      listAllPoliciesForDashboard(ctx, db),
      listAllRenewalsForDashboard(ctx, db),
      listTasks(ctx, db),
      db.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          summary: true,
          createdAt: true,
        },
      }),
    ]);

  const slaProposals = proposals
    .filter((p) => p.slaLevel !== "none")
    .sort((a, b) => SLA_RANK[b.slaLevel] - SLA_RANK[a.slaLevel]);

  const activeProposals = proposals.filter((p) =>
    ACTIVE_PROPOSAL_STATUSES.includes(p.status),
  );
  const vigentePolicies = policies.filter((p) => p.status === "VIGENTE");
  const openTasks = tasks.filter(
    (t) => t.status === "PENDIENTE" || t.status === "EN_PROGRESO",
  );
  const overdueTasks = tasks.filter((t) => t.overdue);

  return {
    metrics: {
      clients,
      activeProposals: activeProposals.length,
      vigentePolicies: vigentePolicies.length,
      renewals: renewals.length,
      openTasks: openTasks.length,
    },
    slaProposals: slaProposals.slice(0, 5),
    renewals: renewals.slice(0, 5),
    overdueTasks: overdueTasks.slice(0, 6),
    recentActivity,
  };
}
