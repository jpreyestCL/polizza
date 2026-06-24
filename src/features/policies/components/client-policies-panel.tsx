"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import type { CurrencyCode } from "@/lib/money";
import { PolicyStatusBadge } from "@/features/policies/components/policy-badges";
import type { ClientPolicyRow } from "@/features/policies/queries";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

type StatusFilter =
  | "VIGENTE"
  | "VENCIDA"
  | "CANCELADA"
  | "ANULADA"
  | "RENOVADA"
  | "ALL";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "VIGENTE", label: "Vigentes" },
  { value: "VENCIDA", label: "Vencidas" },
  { value: "CANCELADA", label: "Canceladas" },
  { value: "ANULADA", label: "Anuladas" },
  { value: "RENOVADA", label: "Renovadas" },
  { value: "ALL", label: "Todas" },
];

function vigencia(start: Date | null, end: Date | null): string {
  if (start && end) return `${formatDate(start)} → ${formatDate(end)}`;
  if (end) return `Vence ${formatDate(end)}`;
  if (start) return `Desde ${formatDate(start)}`;
  return "—";
}

export function ClientPoliciesPanel({
  policies,
}: {
  policies: ClientPolicyRow[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>("VIGENTE");

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: policies.length };
    for (const p of policies) map[p.status] = (map[p.status] ?? 0) + 1;
    return map;
  }, [policies]);

  const visible = useMemo(
    () =>
      filter === "ALL"
        ? policies
        : policies.filter((p) => p.status === filter),
    [policies, filter],
  );

  if (policies.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Sin pólizas"
        description="Este cliente aún no tiene pólizas registradas."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const count = f.value === "ALL" ? counts.ALL : (counts[f.value] ?? 0);
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "ml-1.5 tabular-nums",
                  active ? "opacity-80" : "opacity-60",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No hay pólizas en este estado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">N° Póliza</th>
                <th className="px-3 py-2.5 text-left font-medium">Ramo</th>
                <th className="px-3 py-2.5 text-left font-medium">Producto</th>
                <th className="px-3 py-2.5 text-left font-medium">Compañía</th>
                <th className="px-3 py-2.5 text-left font-medium">Vigencia</th>
                <th className="px-3 py-2.5 text-right font-medium">
                  Prima Bruta
                </th>
                <th className="px-3 py-2.5 text-left font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/polizas/${p.id}`)}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                >
                  <td className="px-3 py-2.5 font-medium text-primary">
                    {p.policyNumber}
                  </td>
                  <td className="px-3 py-2.5">{p.ramo ?? "—"}</td>
                  <td className="px-3 py-2.5">{p.product ?? "—"}</td>
                  <td className="px-3 py-2.5">{p.company ?? "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                    {vigencia(p.startDate, p.endDate)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {p.premiumGross != null
                      ? formatMoney(p.premiumGross, p.currency as CurrencyCode)
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <PolicyStatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
