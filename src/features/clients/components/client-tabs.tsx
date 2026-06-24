"use client";

import Link from "next/link";
import type { ActivityLog } from "@prisma/client";
import {
  Activity,
  Car,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Star,
  TriangleAlert,
  Users,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { formatRut } from "@/lib/rut";
import { formatProposalNumber } from "@/lib/proposal-number";
import type { ClientDetail } from "../queries";
import { CONTACT_ASSIGNMENT_LABELS } from "../schemas";
import { RegisterInteraction } from "./register-interaction";
import { BranchesPanel } from "@/features/branches/components/branches-panel";
import type { BranchItem } from "@/features/branches/queries";
import { ProposalStatusBadge } from "@/features/proposals/components/proposal-badges";
import { ClientPoliciesPanel } from "@/features/policies/components/client-policies-panel";
import type { ClientPolicyRow } from "@/features/policies/queries";
import { ClaimStatusBadge } from "@/features/claims/components/claim-badges";
import { QuotationStatusBadge } from "@/features/car-quotes/components/quotation-badges";
import { DocumentsPanel } from "@/features/documents/components/documents-panel";
import type { DocumentItem } from "@/features/documents/queries";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ClientProposal = {
  id: string;
  proposalNumber: string;
  status: string;
  createdAt: Date;
};

type ClientPolicy = ClientPolicyRow;

type ClientClaim = {
  id: string;
  claimNumber: string;
  status: string;
  occurredAt: Date | null;
};

type ClientCarQuotation = {
  id: string;
  quotationNumber: string;
  status: string;
  patente: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  createdAt: Date;
  bestPremiumUf: number | null;
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  PERSONA: "Persona",
  EMPRESA: "Empresa",
};

export function ClientTabs({
  client,
  activity,
  documents,
  branches,
  clientProposals,
  clientPolicies,
  clientClaims,
  clientCarQuotations,
  assignedUserName,
}: {
  client: ClientDetail;
  activity: ActivityLog[];
  documents: DocumentItem[];
  branches: BranchItem[];
  clientProposals: ClientProposal[];
  clientPolicies: ClientPolicy[];
  clientClaims: ClientClaim[];
  clientCarQuotations: ClientCarQuotation[];
  assignedUserName: string | null;
}) {
  const isEmpresa = client.type === "EMPRESA";
  return (
    <Tabs defaultValue="resumen">
      <TabsList className="flex-wrap">
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="contactos">
          Contactos ({client.contacts.length})
        </TabsTrigger>
        {isEmpresa && (
          <TabsTrigger value="sucursales">
            Sucursales ({branches.length})
          </TabsTrigger>
        )}
        <TabsTrigger value="polizas">Pólizas</TabsTrigger>
        <TabsTrigger value="propuestas">Propuestas</TabsTrigger>
        <TabsTrigger value="cotizaciones">
          Cotizaciones ({clientCarQuotations.length})
        </TabsTrigger>
        <TabsTrigger value="siniestros">Siniestros</TabsTrigger>
        <TabsTrigger value="documentos">Documentos</TabsTrigger>
        <TabsTrigger value="actividad">Actividad</TabsTrigger>
      </TabsList>

      {isEmpresa && (
        <TabsContent value="sucursales">
          <BranchesPanel clientId={client.id} branches={branches} />
        </TabsContent>
      )}

      <TabsContent value="resumen">
        <div className="rounded-xl border bg-card p-5">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Tipo" value={TYPE_LABELS[client.type]} />
            <Field label="RUT" value={formatRut(client.rut)} />
            {client.type === "EMPRESA" && (
              <>
                <Field label="Razón social" value={client.legalName} />
                <Field label="Giro" value={client.giro} />
              </>
            )}
            {client.type === "PERSONA" && (
              <Field
                label="Fecha de nacimiento"
                value={
                  client.birthDate ? formatDate(client.birthDate) : null
                }
              />
            )}
            <Field label="Correo" value={client.email} />
            <Field label="Teléfono" value={client.phone} />
            <Field label="Celular" value={client.celular} />
            <Field label="Dirección" value={client.address} />
            <Field label="Región" value={client.region} />
            <Field label="Comuna" value={client.commune} />
            <Field label="Origen" value={client.source} />
            <Field label="Vendedor" value={client.vendedor} />
            <Field label="Ejecutivo asignado" value={assignedUserName} />
            <Field label="Alta" value={formatDate(client.createdAt)} />
          </dl>
          {client.observaciones?.trim() && (
            <div className="mt-5 border-t pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Observaciones
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {client.observaciones}
              </p>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="contactos">
        {client.contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin contactos"
            description="Este cliente todavía no tiene contactos registrados. Edítalo para agregarlos."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {client.contacts.map((contact) => (
              <div
                key={contact.id}
                className="rounded-xl border bg-card p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{contact.name}</p>
                  {contact.isPrimary && (
                    <Badge variant="default">
                      <Star className="size-3" />
                      Principal
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {contact.role && (
                    <p className="text-sm text-muted-foreground">
                      {contact.role}
                    </p>
                  )}
                  {contact.assignmentType && (
                    <Badge variant="secondary">
                      {CONTACT_ASSIGNMENT_LABELS[contact.assignmentType] ??
                        contact.assignmentType}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
                  {contact.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="size-3.5 text-muted-foreground" />
                      {contact.email}
                    </p>
                  )}
                  {contact.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="size-3.5 text-muted-foreground" />
                      {contact.phone}
                    </p>
                  )}
                  {contact.celular && (
                    <p className="flex items-center gap-2">
                      <MessageCircle className="size-3.5 text-muted-foreground" />
                      {contact.celular}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="polizas">
        <ClientPoliciesPanel policies={clientPolicies} />
      </TabsContent>

      <TabsContent value="propuestas">
        {clientProposals.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin propuestas"
            description="Este cliente aún no tiene propuestas registradas."
          />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {clientProposals.map((proposal) => (
              <li
                key={proposal.id}
                className="flex items-center justify-between gap-3 p-3.5"
              >
                <Link
                  href={`/propuestas/${proposal.id}`}
                  className="font-medium hover:text-primary"
                >
                  {formatProposalNumber(proposal.proposalNumber)}
                </Link>
                <ProposalStatusBadge status={proposal.status} />
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="cotizaciones">
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button asChild size="sm">
              <Link href={`/cotizaciones/nueva?cliente=${client.id}`}>
                <Plus />
                Nueva cotización
              </Link>
            </Button>
          </div>
          {clientCarQuotations.length === 0 ? (
            <EmptyState
              icon={Car}
              title="Sin cotizaciones de auto"
              description="Genera la primera cotización para este cliente."
            />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {clientCarQuotations.map((q) => (
                <li
                  key={q.id}
                  className="flex items-center justify-between gap-3 p-3.5"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/cotizaciones/${q.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {q.quotationNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {q.patente}
                      {q.marca || q.modelo || q.anio
                        ? ` · ${[q.marca, q.modelo, q.anio].filter(Boolean).join(" ")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    {q.bestPremiumUf !== null && (
                      <span className="text-sm">
                        Mejor:{" "}
                        <span className="font-medium">
                          {formatMoney(q.bestPremiumUf, "UF")}
                        </span>
                      </span>
                    )}
                    <QuotationStatusBadge status={q.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </TabsContent>

      <TabsContent value="siniestros">
        {clientClaims.length === 0 ? (
          <EmptyState
            icon={TriangleAlert}
            title="Sin siniestros"
            description="Este cliente no tiene siniestros registrados."
          />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {clientClaims.map((claim) => (
              <li
                key={claim.id}
                className="flex items-center justify-between gap-3 p-3.5"
              >
                <Link
                  href={`/siniestros/${claim.id}`}
                  className="font-medium hover:text-primary"
                >
                  {claim.claimNumber}
                </Link>
                <ClaimStatusBadge status={claim.status} />
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="documentos">
        <DocumentsPanel
          entityType="CLIENT"
          entityId={client.id}
          documents={documents}
        />
      </TabsContent>

      <TabsContent value="actividad">
        <div className="space-y-4">
          <div className="flex justify-end">
            <RegisterInteraction clientId={client.id} />
          </div>
          {activity.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Sin actividad"
              description="Los cambios y gestiones sobre este cliente quedarán registrados aquí."
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
        </div>
      </TabsContent>
    </Tabs>
  );
}
