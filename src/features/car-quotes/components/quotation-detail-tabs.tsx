"use client";

import Link from "next/link";
import type { ActivityLog } from "@prisma/client";
import { Activity, FileText, Layers } from "lucide-react";
import { formatDateTime, formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentsPanel } from "@/features/documents/components/documents-panel";
import type { DocumentItem } from "@/features/documents/queries";
import {
  CIVIL_LIABILITY_LABELS,
  VEHICLE_CONDITION_LABELS,
  VEHICLE_USE_LABELS,
  WORKSHOP_TYPE_LABELS,
  type CivilLiabilityValue,
  type VehicleConditionValue,
  type VehicleUseValue,
  type WorkshopTypeValue,
} from "../schemas";
import type { CarQuotationDetail } from "../queries";
import { ResultsTable } from "./results-table";

function Field({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

export function QuotationDetailTabs({
  quotation,
  activity,
  documents,
  assignedUserName,
}: {
  quotation: CarQuotationDetail;
  activity: ActivityLog[];
  documents: DocumentItem[];
  assignedUserName: string | null;
}) {
  const deductibles = Array.isArray(quotation.deductibles)
    ? (quotation.deductibles as unknown[])
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n))
    : [];
  const deductiblesLabel =
    deductibles.length === 0
      ? "Todos los deducibles"
      : deductibles.map((d) => `UF ${d}`).join(" · ");

  return (
    <Tabs defaultValue="resultados">
      <TabsList className="flex-wrap">
        <TabsTrigger value="resultados">
          Resultados ({quotation.results.length})
        </TabsTrigger>
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="documentos">Documentos</TabsTrigger>
        <TabsTrigger value="actividad">Actividad</TabsTrigger>
      </TabsList>

      <TabsContent value="resultados" className="space-y-6">
        <ResultsTable quotationId={quotation.id} results={quotation.results} />

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`/api/cotizaciones/${quotation.id}/comparativo.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-sm font-medium hover:bg-muted/40"
          >
            <FileText className="size-4" />
            Descargar comparativo (PDF)
          </a>
          <a
            href={`/api/cotizaciones/${quotation.id}/comparativo.csv`}
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-sm font-medium hover:bg-muted/40"
          >
            <Layers className="size-4" />
            Descargar comparativo (Excel · CSV)
          </a>
        </div>
      </TabsContent>

      <TabsContent value="resumen">
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Cliente y vehículo
            </h3>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Cliente"
                value={
                  <Link
                    href={`/clientes/${quotation.client.id}`}
                    className="text-primary hover:underline"
                  >
                    {quotation.client.name}
                  </Link>
                }
              />
              <Field label="Patente" value={quotation.patente} />
              <Field label="Marca" value={quotation.marca} />
              <Field label="Modelo" value={quotation.modelo} />
              <Field label="Año" value={quotation.anio} />
              <Field label="Tipo" value={quotation.tipoVehiculo} />
              <Field label="Motorización" value={quotation.motorizacion} />
              <Field
                label="Estado"
                value={
                  VEHICLE_CONDITION_LABELS[
                    quotation.vehicleCondition as VehicleConditionValue
                  ]
                }
              />
              <Field
                label="Uso"
                value={
                  VEHICLE_USE_LABELS[quotation.vehicleUse as VehicleUseValue]
                }
              />
            </dl>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Coberturas
            </h3>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Responsabilidad civil"
                value={
                  CIVIL_LIABILITY_LABELS[
                    quotation.civilLiability as CivilLiabilityValue
                  ]
                }
              />
              <Field
                label="Taller"
                value={
                  WORKSHOP_TYPE_LABELS[
                    quotation.workshopType as WorkshopTypeValue
                  ]
                }
              />
              <Field label="Deducibles" value={deductiblesLabel} />
              <Field label="Ejecutivo" value={assignedUserName} />
              <Field label="Creada" value={formatDate(quotation.createdAt)} />
              {quotation.previousQuotationId && (
                <Field
                  label="Recotización de"
                  value={
                    <Link
                      href={`/cotizaciones/${quotation.previousQuotationId}`}
                      className="text-primary hover:underline"
                    >
                      Cotización anterior
                    </Link>
                  }
                />
              )}
            </dl>
            {quotation.notes && (
              <div className="mt-5 border-t pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notas
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {quotation.notes}
                </p>
              </div>
            )}
          </div>
          {quotation.results.some((r) => r.status === "OBTENIDA") && (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Mejor oferta
              </h3>
              {(() => {
                const best = [...quotation.results]
                  .filter(
                    (r) => r.status === "OBTENIDA" && r.premiumUf !== null,
                  )
                  .sort((a, b) => (a.premiumUf ?? 0) - (b.premiumUf ?? 0))[0];
                if (!best) return null;
                return (
                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Aseguradora
                      </p>
                      <p className="text-lg font-semibold">{best.insurerName}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Prima anual
                      </p>
                      <p className="text-2xl font-semibold text-primary">
                        {formatMoney(best.premiumUf, "UF")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Deducible
                      </p>
                      <p className="text-lg font-semibold">
                        {best.deductibleUf !== null
                          ? formatMoney(best.deductibleUf, "UF")
                          : "—"}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="documentos">
        <DocumentsPanel
          entityType="CAR_QUOTATION"
          entityId={quotation.id}
          documents={documents}
        />
      </TabsContent>

      <TabsContent value="actividad">
        {activity.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Sin actividad"
            description="Los cambios y envíos de esta cotización aparecerán aquí."
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
