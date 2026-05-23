import Link from "next/link";
import { Users } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listClients, getOrgMembers } from "@/features/clients/queries";
import { getCompanies, getLines } from "@/features/catalog/queries";
import { listOrgBranches } from "@/features/branches/queries";
import { getProposalDetail } from "@/features/proposals/queries";
import { PolicyForm } from "@/features/policies/components/policy-form";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { PolicyFormValues } from "@/features/policies/schemas";
import type { CurrencyCode } from "@/lib/money";

function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function NuevaPolizaPage({
  searchParams,
}: {
  searchParams: Promise<{ fromProposal?: string }>;
}) {
  const { fromProposal } = await searchParams;
  const { ctx, db } = await requireOrgDb();
  const [clients, companies, lines, members, branches] = await Promise.all([
    listClients(ctx, db),
    getCompanies(db),
    getLines(db),
    getOrgMembers(ctx.organizationId),
    listOrgBranches(db),
  ]);

  let defaultValues: PolicyFormValues = {
    clientId: "",
    proposalId: "",
    policyNumber: "",
    companyId: "",
    lineId: "",
    branchId: "",
    premiumNet: "",
    currency: "UF",
    startDate: "",
    endDate: "",
    assignedUserId: ctx.userId,
    items: [],
    coverages: [],
  };

  let fromProposalNumber: string | null = null;
  if (fromProposal) {
    const proposal = await getProposalDetail(db, fromProposal);
    if (proposal) {
      fromProposalNumber = proposal.proposalNumber;
      // Cargar ítems y coberturas de la propuesta para precargar la póliza.
      const proposalItems = await db.proposalItem.findMany({
        where: { proposalId: proposal.id },
        orderBy: { order: "asc" },
        include: {
          branchType: { select: { name: true } },
          coverages: { orderBy: { order: "asc" } },
        },
      });

      const items = proposalItems.map((it) => {
        const data = (it.data ?? {}) as Record<string, unknown>;
        const summary =
          it.identification ??
          (typeof data.patente === "string" ? data.patente : null) ??
          (typeof data.direccion === "string" ? data.direccion : null) ??
          (typeof data.nombre_nave === "string" ? data.nombre_nave : null) ??
          (typeof data.descripcion_riesgo === "string"
            ? data.descripcion_riesgo
            : null) ??
          it.branchType.name;
        const insuredAmount = it.coverages
          .filter((c) => c.sumsToTotal)
          .reduce(
            (sum, c) =>
              sum + (c.insuredAmount ? Number(c.insuredAmount) : 0),
            0,
          );
        return {
          description: summary,
          insuredAmount: insuredAmount > 0 ? String(insuredAmount) : "",
        };
      });

      const seen = new Set<string>();
      const coverages: {
        name: string;
        deductible: string;
        insuredAmount: string;
      }[] = [];
      for (const it of proposalItems) {
        for (const c of it.coverages) {
          if (seen.has(c.name)) continue;
          seen.add(c.name);
          coverages.push({
            name: c.name,
            deductible: "",
            insuredAmount: c.insuredAmount
              ? String(Number(c.insuredAmount))
              : "",
          });
        }
      }

      const totalPremiumNet = proposalItems.reduce(
        (sum, it) =>
          sum +
          it.coverages
            .filter((c) => c.sumsToTotal)
            .reduce(
              (s, c) => s + (c.premiumNet ? Number(c.premiumNet) : 0),
              0,
            ),
        0,
      );

      defaultValues = {
        ...defaultValues,
        clientId: proposal.clientId,
        proposalId: proposal.id,
        companyId: proposal.companyId ?? "",
        lineId: proposal.lineId ?? "",
        branchId: proposal.branchId ?? "",
        premiumNet:
          totalPremiumNet > 0
            ? String(totalPremiumNet)
            : proposal.premiumNet !== null
              ? String(proposal.premiumNet)
              : "",
        currency: proposal.currency as CurrencyCode,
        startDate: toDateInput(proposal.startDate),
        endDate: toDateInput(proposal.endDate),
        assignedUserId: proposal.assignedUserId ?? ctx.userId,
        items,
        coverages,
      };
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva póliza"
        description={
          fromProposalNumber
            ? `Convirtiendo la propuesta ${fromProposalNumber}. Completa el número de póliza y la vigencia.`
            : "Registra una póliza emitida en la cartera."
        }
      />
      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Necesitas un cliente primero"
          description="Una póliza siempre se asocia a un cliente. Crea un cliente antes de continuar."
          action={
            <Button asChild>
              <Link href="/clientes/nuevo">Crear cliente</Link>
            </Button>
          }
        />
      ) : (
        <PolicyForm
          mode="create"
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          companies={companies}
          lines={lines}
          members={members}
          branches={branches}
          defaultValues={defaultValues}
        />
      )}
    </div>
  );
}
