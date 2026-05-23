"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Loader2, Wallet } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { markInstallmentPaidAction } from "../actions";
import type { InstallmentWithPolicy } from "../queries";
import { InstallmentBadge } from "./installment-badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

type Filter = "all" | "vencida" | "porvencer" | "pagada";

export function CobranzaOverview({
  installments,
}: {
  installments: InstallmentWithPolicy[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const overdueCount = installments.filter((i) => i.overdue).length;
  const pendingCount = installments.filter(
    (i) => i.status === "PENDIENTE" && !i.overdue,
  ).length;
  const paidCount = installments.filter((i) => i.status === "PAGADA").length;

  const visible = installments.filter((i) => {
    if (filter === "vencida") return i.overdue;
    if (filter === "porvencer") return i.status === "PENDIENTE" && !i.overdue;
    if (filter === "pagada") return i.status === "PAGADA";
    return true;
  });

  async function markPaid(id: string) {
    setBusyId(id);
    const result = await markInstallmentPaidAction(id);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Cuota marcada como pagada");
    router.refresh();
  }

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: `Todas (${installments.length})` },
    { value: "vencida", label: `Vencidas (${overdueCount})` },
    { value: "porvencer", label: `Por vencer (${pendingCount})` },
    { value: "pagada", label: `Pagadas (${paidCount})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={filter === option.value ? "default" : "outline"}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Sin cuotas"
          description="No hay cuotas que coincidan con el filtro seleccionado."
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {visible.map((installment) => (
            <li
              key={installment.id}
              className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/polizas/${installment.policyId}`}
                    className="font-medium hover:text-primary"
                  >
                    {installment.policyNumber}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    · Cuota {installment.number}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {installment.clientName} · vence el{" "}
                  {formatDate(installment.dueDate)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {formatMoney(
                    installment.amount,
                    installment.currency as CurrencyCode,
                  )}
                </span>
                <InstallmentBadge
                  status={installment.status}
                  overdue={installment.overdue}
                />
                {installment.status !== "PAGADA" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === installment.id}
                    onClick={() => markPaid(installment.id)}
                  >
                    {busyId === installment.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Check />
                    )}
                    Pagar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
