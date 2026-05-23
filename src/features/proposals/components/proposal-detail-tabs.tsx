"use client";

import Link from "next/link";
import type { ActivityLog } from "@prisma/client";
import { Activity, History } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ProposalDetail } from "../queries";
import { ProposalStatusBadge } from "./proposal-badges";
import { DocumentsPanel } from "@/features/documents/components/documents-panel";
import type { DocumentItem } from "@/features/documents/queries";
import { MoneyValue } from "@/components/money-value";
import { EmptyState } from "@/components/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

type PremiumTotals = {
  affect: number;
  exempt: number;
  net: number;
  iva: number;
  gross: number;
};

export function ProposalDetailTabs({
  proposal,
  activity,
  documents,
  companyName,
  branchTypeName,
  assignedUserName,
  ufValue,
  premiumTotals,
  timezone,
}: {
  proposal: ProposalDetail;
  activity: ActivityLog[];
  documents: DocumentItem[];
  companyName: string | null;
  branchTypeName: string | null;
  assignedUserName: string | null;
  ufValue: number | null;
  premiumTotals: PremiumTotals;
  timezone: string;
}) {
  const vigencia =
    proposal.startDate || proposal.endDate
      ? `${formatDate(proposal.startDate)} — ${formatDate(proposal.endDate)}`
      : "—";

  const showAggregates =
    premiumTotals.affect > 0 ||
    premiumTotals.exempt > 0 ||
    premiumTotals.iva > 0 ||
    premiumTotals.gross > 0;
  const grossToShow = showAggregates ? premiumTotals.gross : proposal.premiumGross;

  return (
    <Tabs defaultValue="resumen">
      <TabsList className="flex-wrap">
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="historial">
          Historial ({proposal.statusHistory.length})
        </TabsTrigger>
        <TabsTrigger value="documentos">Documentos</TabsTrigger>
        <TabsTrigger value="actividad">Actividad</TabsTrigger>
      </TabsList>

      <TabsContent value="resumen">
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Contratante"
                value={
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <Link
                      href={`/clientes/${proposal.client.id}`}
                      className="text-primary hover:underline"
                    >
                      {proposal.client.name}
                    </Link>
                    {proposal.client.rut && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {proposal.client.rut}
                      </span>
                    )}
                  </span>
                }
              />
              <Field label="Compañía" value={companyName} />
              <Field label="Ramo" value={branchTypeName} />
              <Field label="Moneda" value={proposal.currency} />
              <Field
                label="Prima afecta"
                value={
                  showAggregates ? (
                    <MoneyValue
                      amount={premiumTotals.affect}
                      currency={proposal.currency}
                      ufValue={ufValue}
                    />
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="Prima exenta"
                value={
                  showAggregates ? (
                    <MoneyValue
                      amount={premiumTotals.exempt}
                      currency={proposal.currency}
                      ufValue={ufValue}
                    />
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="IVA"
                value={
                  showAggregates ? (
                    <MoneyValue
                      amount={premiumTotals.iva}
                      currency={proposal.currency}
                      ufValue={ufValue}
                    />
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="Prima bruta"
                value={
                  grossToShow != null ? (
                    <MoneyValue
                      amount={grossToShow}
                      currency={proposal.currency}
                      ufValue={ufValue}
                    />
                  ) : (
                    "—"
                  )
                }
              />
              <Field label="Vigencia" value={vigencia} />
              <Field label="Ejecutivo" value={assignedUserName} />
              <Field label="Creada" value={formatDate(proposal.createdAt)} />
            </dl>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="historial">
        {proposal.statusHistory.length === 0 ? (
          <EmptyState
            icon={History}
            title="Sin historial"
            description="Los cambios de estado de la propuesta quedarán aquí."
          />
        ) : (
          <ul className="space-y-3">
            {proposal.statusHistory.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-3 rounded-lg border bg-card p-3"
              >
                <ProposalStatusBadge status={entry.status} />
                <div className="min-w-0 flex-1">
                  {entry.note && <p className="text-sm">{entry.note}</p>}
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt, timezone)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="documentos">
        <DocumentsPanel
          entityType="PROPOSAL"
          entityId={proposal.id}
          documents={documents}
        />
      </TabsContent>

      <TabsContent value="actividad">
        {activity.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Sin actividad"
            description="Los cambios sobre esta propuesta quedarán registrados aquí."
          />
        ) : (
          <ul className="space-y-3">
            {activity.map((entry) => (
              <li key={entry.id} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="text-sm">{entry.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt, timezone)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
