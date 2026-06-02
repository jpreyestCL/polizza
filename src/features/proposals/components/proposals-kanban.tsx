"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { changeProposalStatusAction } from "../actions";
import {
  PROPOSAL_STATUSES,
  STATUS_LABELS,
  type ProposalStatusValue,
} from "../schemas";
import type { ProposalListItem } from "../queries";
import type { CatalogItem } from "@/features/catalog/queries";
import { ProposalSlaBadge } from "./proposal-badges";
import { StatusChangeDialog } from "./status-change-dialog";

type Dragged = { id: string; status: ProposalStatusValue };

export function ProposalsKanban({
  proposals,
  companies,
  returnReasons,
}: {
  proposals: ProposalListItem[];
  companies: CatalogItem[];
  returnReasons: CatalogItem[];
}) {
  const router = useRouter();
  const [dragged, setDragged] = useState<Dragged | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [returnDialog, setReturnDialog] = useState<{
    proposalId: string;
    currentStatus: ProposalStatusValue;
  } | null>(null);

  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  async function move(item: Dragged, to: ProposalStatusValue) {
    if (item.status === to) return;
    // "Por despachar" se asigna al registrar la recepción de la póliza, no por
    // arrastre manual (review #2).
    if (to === "POR_DESPACHAR") {
      toast.error(
        "“Por despachar” se asigna al registrar la recepción de la póliza emitida, no arrastrando la tarjeta.",
      );
      return;
    }
    if (to === "DEVUELTA") {
      setReturnDialog({ proposalId: item.id, currentStatus: item.status });
      return;
    }
    const result = await changeProposalStatusAction(item.id, {
      status: to,
      note: "",
      returnReasonId: "",
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Propuesta movida a ${STATUS_LABELS[to]}`);
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {PROPOSAL_STATUSES.map((status) => {
          const items = proposals.filter((p) => p.status === status);
          return (
            <div
              key={status}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(status);
              }}
              onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
              onDrop={() => {
                setDragOver(null);
                if (dragged) void move(dragged, status);
                setDragged(null);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors",
                dragOver === status && "border-primary bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm font-medium">
                  {STATUS_LABELS[status]}
                </span>
                <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <div className="flex min-h-24 flex-col gap-2 px-2 pb-2">
                {items.map((proposal) => (
                  <article
                    key={proposal.id}
                    draggable
                    onDragStart={() =>
                      setDragged({ id: proposal.id, status })
                    }
                    onDragEnd={() => setDragged(null)}
                    onClick={() => router.push(`/propuestas/${proposal.id}`)}
                    className="cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {proposal.proposalNumber}
                      </span>
                      <ProposalSlaBadge
                        level={proposal.slaLevel}
                        days={proposal.daysInState}
                      />
                    </div>
                    {proposal.policyNumberGenerated && (
                      <p className="mt-0.5 text-xs font-medium text-success">
                        Póliza N° {proposal.policyNumberGenerated}
                      </p>
                    )}
                    <p className="mt-1 truncate text-sm">
                      {proposal.client.name}
                    </p>
                    {proposal.companyId &&
                      companyName.has(proposal.companyId) && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Building2 className="size-3" />
                          {companyName.get(proposal.companyId)}
                        </p>
                      )}
                    {proposal.premiumNet !== null && (
                      <p className="mt-1 text-sm font-medium text-primary">
                        {formatMoney(
                          proposal.premiumNet,
                          proposal.currency as CurrencyCode,
                        )}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {returnDialog && (
        <StatusChangeDialog
          proposalId={returnDialog.proposalId}
          currentStatus={returnDialog.currentStatus}
          returnReasons={returnReasons}
          presetStatus="DEVUELTA"
          open
          onOpenChange={(open) => {
            if (!open) setReturnDialog(null);
          }}
        />
      )}
    </>
  );
}
