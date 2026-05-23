"use client";

import Link from "next/link";
import type { ActivityLog } from "@prisma/client";
import { Activity, History } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ClaimDetail } from "../queries";
import { ClaimStatusBadge } from "./claim-badges";
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

export function ClaimDetailTabs({
  claim,
  activity,
  documents,
  policyNumber,
  assignedUserName,
  ufValue,
}: {
  claim: ClaimDetail;
  activity: ActivityLog[];
  documents: DocumentItem[];
  policyNumber: string | null;
  assignedUserName: string | null;
  ufValue: number | null;
}) {
  return (
    <Tabs defaultValue="resumen">
      <TabsList className="flex-wrap">
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="historial">
          Historial ({claim.statusHistory.length})
        </TabsTrigger>
        <TabsTrigger value="documentos">Documentos</TabsTrigger>
        <TabsTrigger value="actividad">Actividad</TabsTrigger>
      </TabsList>

      <TabsContent value="resumen">
        <div className="rounded-xl border bg-card p-5">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Cliente"
              value={
                <Link
                  href={`/clientes/${claim.client.id}`}
                  className="text-primary hover:underline"
                >
                  {claim.client.name}
                </Link>
              }
            />
            <Field
              label="Póliza"
              value={
                claim.policyId && policyNumber ? (
                  <Link
                    href={`/polizas/${claim.policyId}`}
                    className="text-primary hover:underline"
                  >
                    {policyNumber}
                  </Link>
                ) : null
              }
            />
            <Field label="Ejecutivo" value={assignedUserName} />
            <Field
              label="Ocurrencia"
              value={formatDate(claim.occurredAt)}
            />
            <Field label="Denuncio" value={formatDate(claim.reportedAt)} />
            <Field label="Reportado" value={formatDate(claim.createdAt)} />
            <Field
              label="Monto estimado"
              value={
                <MoneyValue
                  amount={claim.estimatedAmount}
                  currency={claim.currency}
                  ufValue={ufValue}
                />
              }
            />
            <Field
              label="Monto liquidado"
              value={
                <MoneyValue
                  amount={claim.settledAmount}
                  currency={claim.currency}
                  ufValue={ufValue}
                />
              }
            />
          </dl>
          <div className="mt-5 border-t pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Descripción
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {claim.description}
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="historial">
        {claim.statusHistory.length === 0 ? (
          <EmptyState
            icon={History}
            title="Sin historial"
            description="Los cambios de estado del siniestro quedarán aquí."
          />
        ) : (
          <ul className="space-y-3">
            {claim.statusHistory.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-3 rounded-lg border bg-card p-3"
              >
                <ClaimStatusBadge status={entry.status} />
                <div className="min-w-0 flex-1">
                  {entry.note && <p className="text-sm">{entry.note}</p>}
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="documentos">
        <DocumentsPanel
          entityType="CLAIM"
          entityId={claim.id}
          documents={documents}
        />
      </TabsContent>

      <TabsContent value="actividad">
        {activity.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Sin actividad"
            description="Los cambios sobre este siniestro quedarán registrados aquí."
          />
        ) : (
          <ul className="space-y-3">
            {activity.map((entry) => (
              <li key={entry.id} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="text-sm">{entry.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
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
