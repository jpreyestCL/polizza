import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, Pencil } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import {
  getCarQuotationActivity,
  getCarQuotationDetail,
} from "@/features/car-quotes/queries";
import { getOrgMembers } from "@/features/clients/queries";
import { listDocuments } from "@/features/documents/queries";
import { QuotationStatusBadge } from "@/features/car-quotes/components/quotation-badges";
import { QuotationDetailTabs } from "@/features/car-quotes/components/quotation-detail-tabs";
import { PollQuotation } from "@/features/car-quotes/components/poll-quotation";
import { SendQuotationDialog } from "@/features/car-quotes/components/send-quotation-dialog";
import { DeleteQuotationDialog } from "@/features/car-quotes/components/delete-quotation-dialog";
import { canDeleteProposal } from "@/lib/roles";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";

export default async function CotizacionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ctx, db } = await requireOrgDb();

  const quotation = await getCarQuotationDetail(db, id);
  if (!quotation) notFound();

  const [activity, documents, members] = await Promise.all([
    getCarQuotationActivity(db, id),
    listDocuments(db, "CAR_QUOTATION", id),
    getOrgMembers(ctx.organizationId),
  ]);

  const assignedUserName = quotation.assignedUserId
    ? (members.find((m) => m.userId === quotation.assignedUserId)?.name ?? null)
    : null;

  const attachableResults = quotation.results
    .filter((r) => r.status === "OBTENIDA" && r.premiumUf !== null)
    .map((r) => ({
      id: r.id,
      insurerName: r.insurerName,
      premiumLabel: formatMoney(r.premiumUf, "UF"),
    }));

  const defaultSubject = `Cotización ${quotation.quotationNumber} — ${[
    quotation.marca,
    quotation.modelo,
  ]
    .filter(Boolean)
    .join(" ") || quotation.patente}`;

  const canSendEmail = quotation.results.some((r) => r.status === "OBTENIDA");

  return (
    <div className="space-y-6">
      <PollQuotation status={quotation.status} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {quotation.quotationNumber}
            </h1>
            <QuotationStatusBadge status={quotation.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/clientes/${quotation.client.id}`}
              className="hover:text-foreground"
            >
              {quotation.client.name}
            </Link>{" "}
            · {quotation.patente}
            {quotation.marca || quotation.modelo
              ? ` · ${[quotation.marca, quotation.modelo, quotation.anio].filter(Boolean).join(" ")}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSendEmail && (
            <SendQuotationDialog
              quotationId={quotation.id}
              contacts={quotation.client.contacts.map((c) => ({
                id: c.id,
                name: c.name,
                email: c.email!,
                isPrimary: c.isPrimary,
              }))}
              attachableResults={attachableResults}
              defaultSubject={defaultSubject}
            />
          )}
          <Button asChild variant="outline">
            <Link href={`/cotizaciones/${id}/recotizar`}>
              <Copy />
              Recotizar
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/cotizaciones/nueva?cliente=${quotation.client.id}`}>
              <Pencil />
              Nueva
            </Link>
          </Button>
          {canDeleteProposal(ctx.role) && (
            <DeleteQuotationDialog
              quotationId={id}
              quotationNumber={quotation.quotationNumber}
            />
          )}
        </div>
      </div>

      <QuotationDetailTabs
        quotation={quotation}
        activity={activity}
        documents={documents}
        assignedUserName={assignedUserName}
      />
    </div>
  );
}
