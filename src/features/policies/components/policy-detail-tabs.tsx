"use client";

import Link from "next/link";
import type { ActivityLog } from "@prisma/client";
import { Activity, History, Package, Shield } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { PolicyDetail } from "../queries";
import { PolicyStatusBadge } from "./policy-badges";
import { DocumentsPanel } from "@/features/documents/components/documents-panel";
import type { DocumentItem } from "@/features/documents/queries";
import { CobranzaPanel } from "@/features/billing/components/cobranza-panel";
import type { InstallmentItem } from "@/features/billing/queries";
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

export function PolicyDetailTabs({
  policy,
  activity,
  documents,
  installments,
  companyName,
  lineName,
  assignedUserName,
  ufValue,
}: {
  policy: PolicyDetail;
  activity: ActivityLog[];
  documents: DocumentItem[];
  installments: InstallmentItem[];
  companyName: string | null;
  lineName: string | null;
  assignedUserName: string | null;
  ufValue: number | null;
}) {
  const currency = policy.currency as CurrencyCode;
  const insuredTotal = policy.items.reduce(
    (sum, item) => sum + (item.insuredAmount ?? 0),
    0,
  );
  const vigencia =
    policy.startDate || policy.endDate
      ? `${formatDate(policy.startDate)} — ${formatDate(policy.endDate)}`
      : "—";

  return (
    <Tabs defaultValue="resumen">
      <TabsList className="flex-wrap">
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="materia">
          Materia ({policy.items.length})
        </TabsTrigger>
        <TabsTrigger value="coberturas">
          Coberturas ({policy.coverages.length})
        </TabsTrigger>
        <TabsTrigger value="cobranza">
          Cobranza ({installments.length})
        </TabsTrigger>
        <TabsTrigger value="historial">
          Historial ({policy.statusHistory.length})
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
                  href={`/clientes/${policy.client.id}`}
                  className="text-primary hover:underline"
                >
                  {policy.client.name}
                </Link>
              }
            />
            <Field label="Compañía" value={companyName} />
            <Field label="Ramo" value={lineName} />
            <Field
              label="Prima neta"
              value={
                <MoneyValue
                  amount={policy.premiumNet}
                  currency={policy.currency}
                  ufValue={ufValue}
                />
              }
            />
            <Field
              label="Prima bruta"
              value={
                <MoneyValue
                  amount={policy.premiumGross}
                  currency={policy.currency}
                  ufValue={ufValue}
                />
              }
            />
            <Field label="Vigencia" value={vigencia} />
            <Field label="Ejecutivo" value={assignedUserName} />
            {policy.proposalId && (
              <Field
                label="Propuesta de origen"
                value={
                  <Link
                    href={`/propuestas/${policy.proposalId}`}
                    className="text-primary hover:underline"
                  >
                    Ver propuesta
                  </Link>
                }
              />
            )}
            {policy.previousPolicyId && (
              <Field
                label="Póliza anterior"
                value={
                  <Link
                    href={`/polizas/${policy.previousPolicyId}`}
                    className="text-primary hover:underline"
                  >
                    Ver póliza anterior
                  </Link>
                }
              />
            )}
            {policy.nextPolicyId && (
              <Field
                label="Renovada como"
                value={
                  <Link
                    href={`/polizas/${policy.nextPolicyId}`}
                    className="text-primary hover:underline"
                  >
                    Ver renovación
                  </Link>
                }
              />
            )}
            <Field label="Creada" value={formatDate(policy.createdAt)} />
          </dl>
        </div>
      </TabsContent>

      <TabsContent value="materia">
        {policy.items.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Sin materia asegurada"
            description="Edita la póliza para registrar los bienes asegurados."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Item</th>
                  <th className="px-3 py-2.5 text-left font-medium">
                    Identificación del Riesgo
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium">Moneda</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Monto Asegurado
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Prima Bruta
                  </th>
                </tr>
              </thead>
              <tbody>
                {policy.items.map((item, idx) => (
                  <tr key={item.id} className="border-b last:border-0 align-top">
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2.5 whitespace-pre-line">
                      {item.description}
                    </td>
                    <td className="px-3 py-2.5">{item.currency}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {item.insuredAmount !== null
                        ? formatMoney(
                            item.insuredAmount,
                            item.currency as CurrencyCode,
                          )
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {/* La prima no se desglosa por ítem; con un único ítem
                          equivale a la prima bruta de la póliza. */}
                      {policy.items.length === 1 && policy.premiumGross != null
                        ? formatMoney(policy.premiumGross, currency)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30 font-medium">
                <tr>
                  <td className="px-3 py-2.5" colSpan={3}>
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatMoney(insuredTotal, currency)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {policy.premiumGross != null
                      ? formatMoney(policy.premiumGross, currency)
                      : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="coberturas">
        {policy.coverages.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="Sin coberturas"
            description="Edita la póliza para registrar las coberturas contratadas."
          />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {policy.coverages.map((coverage) => (
              <li key={coverage.id} className="flex flex-col gap-1 p-3.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium">{coverage.name}</span>
                  <span className="text-sm">
                    {coverage.insuredAmount !== null
                      ? formatMoney(
                          coverage.insuredAmount,
                          coverage.currency as CurrencyCode,
                        )
                      : "—"}
                  </span>
                </div>
                {coverage.deductible && (
                  <span className="text-xs text-muted-foreground">
                    Deducible: {coverage.deductible}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="cobranza">
        <CobranzaPanel
          policyId={policy.id}
          installments={installments}
          defaultCurrency={currency}
        />
      </TabsContent>

      <TabsContent value="historial">
        {policy.statusHistory.length === 0 ? (
          <EmptyState
            icon={History}
            title="Sin historial"
            description="Los cambios de estado de la póliza quedarán aquí."
          />
        ) : (
          <ul className="space-y-3">
            {policy.statusHistory.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-3 rounded-lg border bg-card p-3"
              >
                <PolicyStatusBadge status={entry.status} />
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
          entityType="POLICY"
          entityId={policy.id}
          documents={documents}
        />
      </TabsContent>

      <TabsContent value="actividad">
        {activity.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Sin actividad"
            description="Los cambios sobre esta póliza quedarán registrados aquí."
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
