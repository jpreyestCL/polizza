import Link from "next/link";
import { Activity, AlertTriangle, CalendarClock, Clock } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { getDashboardData } from "@/features/dashboard/queries";
import { ProposalSlaBadge } from "@/features/proposals/components/proposal-badges";
import { PolicyRenewalBadge } from "@/features/policies/components/policy-badges";
import { TaskPriorityBadge } from "@/features/tasks/components/task-badges";
import { PageHeader } from "@/components/page-header";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { formatProposalNumber } from "@/lib/proposal-number";

function entityHref(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "CLIENT":
      return `/clientes/${entityId}`;
    case "PROPOSAL":
      return `/propuestas/${entityId}`;
    case "POLICY":
      return `/polizas/${entityId}`;
    case "TASK":
      return "/tareas";
    default:
      return null;
  }
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold">
      <Icon className="size-4 text-muted-foreground" />
      {children}
    </h2>
  );
}

export default async function PanelPage() {
  const { ctx, db } = await requireOrgDb();
  const data = await getDashboardData(ctx, db);

  const metrics = [
    { label: "Clientes", value: data.metrics.clients, href: "/clientes" },
    {
      label: "Propuestas en flujo",
      value: data.metrics.activeProposals,
      href: "/propuestas",
    },
    {
      label: "Pólizas vigentes",
      value: data.metrics.vigentePolicies,
      href: "/polizas",
    },
    {
      label: "Renovaciones",
      value: data.metrics.renewals,
      href: "/renovaciones",
      alert: data.metrics.renewals > 0,
    },
    {
      label: "Tareas abiertas",
      value: data.metrics.openTasks,
      href: "/tareas",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel"
        description="Resumen operativo de la corredora."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((metric) => (
          <Link
            key={metric.label}
            href={metric.href}
            className={cn(
              "rounded-xl border bg-card px-4 py-3.5 transition-colors hover:border-primary/40",
              metric.alert && "border-warning/40 bg-warning/5",
            )}
          >
            <p className="text-2xl font-semibold tracking-tight">
              {metric.value}
            </p>
            <p className="text-xs text-muted-foreground">{metric.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <SectionTitle icon={AlertTriangle}>
              Propuestas con alerta de SLA
            </SectionTitle>
            {data.slaProposals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ninguna propuesta supera el plazo con la compañía.
              </p>
            ) : (
              <ul className="divide-y">
                {data.slaProposals.map((proposal) => (
                  <li key={proposal.id} className="py-2.5">
                    <Link
                      href={`/propuestas/${proposal.id}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">
                          {formatProposalNumber(proposal.proposalNumber)}
                        </span>
                        <span className="ml-2 text-sm text-muted-foreground">
                          {proposal.client.name}
                        </span>
                      </span>
                      <ProposalSlaBadge
                        level={proposal.slaLevel}
                        days={proposal.daysInState}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-xl border bg-card p-5">
            <SectionTitle icon={CalendarClock}>
              Renovaciones por gestionar
            </SectionTitle>
            {data.renewals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ninguna póliza vence en los próximos 60 días.
              </p>
            ) : (
              <ul className="divide-y">
                {data.renewals.map((policy) => (
                  <li key={policy.id} className="py-2.5">
                    <Link
                      href={`/polizas/${policy.id}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">
                          {policy.policyNumber}
                        </span>
                        <span className="ml-2 text-sm text-muted-foreground">
                          {policy.client.name}
                        </span>
                      </span>
                      <PolicyRenewalBadge
                        level={policy.renewalLevel}
                        days={policy.daysToExpiry}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-xl border bg-card p-5">
            <SectionTitle icon={Clock}>Tareas vencidas</SectionTitle>
            {data.overdueTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tienes tareas vencidas. Buen trabajo.
              </p>
            ) : (
              <ul className="divide-y">
                {data.overdueTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{task.title}</span>
                      {task.dueDate && (
                        <span className="ml-2 text-sm text-destructive">
                          venció el {formatDate(task.dueDate)}
                        </span>
                      )}
                    </span>
                    <TaskPriorityBadge priority={task.priority} />
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/tareas"
              className="inline-block text-sm text-primary hover:underline"
            >
              Ver todas las tareas
            </Link>
          </section>
        </div>

        <section className="space-y-3 rounded-xl border bg-card p-5">
          <SectionTitle icon={Activity}>Actividad reciente</SectionTitle>
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay actividad registrada.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.recentActivity.map((entry) => {
                const href = entityHref(entry.entityType, entry.entityId);
                const content = (
                  <>
                    <p className="text-sm">{entry.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </>
                );
                return (
                  <li key={entry.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    {href ? (
                      <Link href={href} className="min-w-0 hover:underline">
                        {content}
                      </Link>
                    ) : (
                      <div className="min-w-0">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
