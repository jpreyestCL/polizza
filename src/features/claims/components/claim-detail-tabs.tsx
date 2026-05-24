"use client";

import type { ActivityLog } from "@prisma/client";
import { Activity, History } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { ClaimDetail, BranchFieldDef } from "../queries";
import { ClaimStatusBadge } from "./claim-badges";
import { ClaimDetailsForm } from "./claim-details-form";
import { ClaimCompanyInfoCard } from "./claim-company-info-card";
import { ClaimThirdPartiesPanel } from "./claim-third-parties-panel";
import { ClaimLogPanel } from "./claim-log-panel";
import { DocumentsPanel } from "@/features/documents/components/documents-panel";
import type { DocumentItem } from "@/features/documents/queries";
import { EmptyState } from "@/components/empty-state";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export function ClaimDetailTabs({
  claim,
  activity,
  documents,
  branchFields,
  members,
}: {
  claim: ClaimDetail;
  activity: ActivityLog[];
  documents: DocumentItem[];
  branchFields: BranchFieldDef[];
  members: { userId: string; name: string }[];
}) {
  return (
    <Tabs defaultValue="datos">
      <TabsList className="flex-wrap">
        <TabsTrigger value="datos">Denuncio</TabsTrigger>
        <TabsTrigger value="ramo">Datos del ramo</TabsTrigger>
        <TabsTrigger value="terceros">
          Terceros ({claim.thirdParties.length})
        </TabsTrigger>
        <TabsTrigger value="compania">Compañía</TabsTrigger>
        <TabsTrigger value="documentos">
          Documentos ({documents.length})
        </TabsTrigger>
        <TabsTrigger value="bitacora">
          Bitácora ({claim.logs.length})
        </TabsTrigger>
        <TabsTrigger value="historial">
          Estados ({claim.statusHistory.length})
        </TabsTrigger>
        <TabsTrigger value="actividad">Actividad</TabsTrigger>
      </TabsList>

      <TabsContent value="datos">
        <ClaimDetailsForm
          claim={claim}
          branchFields={branchFields}
          members={members}
        />
      </TabsContent>

      <TabsContent value="ramo">
        <BranchDataPanel claim={claim} />
      </TabsContent>

      <TabsContent value="terceros">
        <ClaimThirdPartiesPanel
          claimId={claim.id}
          thirdParties={claim.thirdParties}
        />
      </TabsContent>

      <TabsContent value="compania">
        <ClaimCompanyInfoCard claim={claim} />
      </TabsContent>

      <TabsContent value="documentos">
        <DocumentsPanel
          entityType="CLAIM"
          entityId={claim.id}
          documents={documents}
        />
      </TabsContent>

      <TabsContent value="bitacora">
        <ClaimLogPanel claimId={claim.id} logs={claim.logs} />
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

function BranchDataPanel({ claim }: { claim: ClaimDetail }) {
  const item = claim.proposalItem;
  const data = (item?.data ?? {}) as Record<string, unknown>;
  const entries = Object.entries(data).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  const branchName = claim.branchType?.name ?? item?.branchType?.name ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">Datos del ítem siniestrado</h3>
        <p className="text-xs text-muted-foreground">
          {branchName
            ? `Ramo: ${branchName}`
            : "Ítem sin ramo registrado"}
        </p>
        {claim.policyItem ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-muted-foreground">
                Descripción
              </dt>
              <dd className="text-sm">{claim.policyItem.description}</dd>
            </div>
            {claim.policyItemAmount !== null && (
              <div>
                <dt className="text-xs uppercase text-muted-foreground">
                  Monto asegurado
                </dt>
                <dd className="text-sm">
                  {claim.policyItemAmount.toLocaleString()}{" "}
                  {claim.policyItem.currency}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Este denuncio no tiene un ítem de póliza vinculado.
          </p>
        )}
      </div>

      {entries.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Ficha original (propuesta)</h3>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs uppercase text-muted-foreground">
                  {key}
                </dt>
                <dd className="text-sm">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
