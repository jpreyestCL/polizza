import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import { addQuoteOfferAction, moveQuoteRequestAction } from "@/features/quotes/actions";
import { canMoveQuote } from "@/lib/domain/quote-flow";
import { PageHeader } from "@/components/page-header";
import { formatMoney, type CurrencyCode } from "@/lib/money";

const LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  SOLICITADA: "Solicitada",
  COTIZADA: "Cotizada",
  ENVIADA_CLIENTE: "Enviada al cliente",
  GANADA: "Ganada",
  PERDIDA: "Perdida",
};

const NEXT: Record<string, { status: string; label: string }[]> = {
  BORRADOR: [{ status: "SOLICITADA", label: "Marcar solicitada" }],
  SOLICITADA: [{ status: "COTIZADA", label: "Marcar cotizada" }],
  COTIZADA: [{ status: "ENVIADA_CLIENTE", label: "Enviar al cliente" }],
  ENVIADA_CLIENTE: [
    { status: "GANADA", label: "Cliente acepta y crear propuesta" },
    { status: "PERDIDA", label: "Cliente desiste" },
  ],
};

export default async function CotizacionDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { db } = await requireOrgDb();
  const request = await db.quoteRequest.findFirst({
    where: { id },
    include: {
      client: { select: { name: true } },
      offers: { orderBy: { createdAt: "asc" } },
      proposal: { select: { id: true, proposalNumber: true } },
    },
  });
  if (!request) notFound();
  const error = typeof sp.error === "string" ? sp.error : null;
  const closed = request.status === "GANADA" || request.status === "PERDIDA";

  return (
    <div className="space-y-6">
      <PageHeader
        title={request.title}
        description={`${request.client.name} · ${LABEL[request.status] ?? request.status}`}
      />
      {error ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          {error === "oferta"
            ? "Agrega al menos una oferta antes de avanzar."
            : error === "motivo"
              ? "La pérdida necesita un motivo de al menos 10 caracteres."
              : "No se pudo cambiar el estado."}
        </p>
      ) : null}
      {request.proposal ? (
        <p className="text-sm">
          Propuesta{" "}
          <Link className="text-primary hover:underline" href={`/propuestas/${request.proposal.id}`}>
            {request.proposal.proposalNumber}
          </Link>
        </p>
      ) : null}
      {request.lossReason ? (
        <p className="text-sm text-muted-foreground">Motivo: {request.lossReason}</p>
      ) : null}

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Ofertas</h2>
        {request.offers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ofertas todavía.</p>
        ) : (
          <ul className="divide-y text-sm">
            {request.offers.map((offer) => (
              <li key={offer.id} className="flex justify-between py-2">
                <span>
                  {offer.insurerName}
                  {offer.recommended ? " · recomendada" : ""}
                </span>
                <span>
                  {offer.premiumNet == null
                    ? "sin prima"
                    : formatMoney(Number(offer.premiumNet), offer.currency as CurrencyCode)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {closed ? null : (
          <form action={addQuoteOfferAction} className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="requestId" value={request.id} />
            <input name="insurerName" required placeholder="Compañía" className="rounded-md border bg-background px-2 py-1.5 text-sm" />
            <input name="premiumNet" placeholder="Prima neta" className="rounded-md border bg-background px-2 py-1.5 text-sm" />
            <input name="notes" placeholder="Nota" className="rounded-md border bg-background px-2 py-1.5 text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="recommended" value="1" />
              Recomendada
            </label>
            <button type="submit" className="rounded-md border px-3 py-2 text-sm sm:col-span-2">Agregar oferta</button>
          </form>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        {(NEXT[request.status] ?? [])
          .filter((step) => canMoveQuote(request.status, step.status))
          .map((step) => (
            <form key={step.status} action={moveQuoteRequestAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="status" value={step.status} />
              {step.status === "PERDIDA" ? (
                <input name="lossReason" required minLength={10} placeholder="Por qué se perdió" className="rounded-md border bg-background px-2 py-1.5 text-sm" />
              ) : null}
              <button type="submit" className="rounded-md border px-3 py-2 text-sm">{step.label}</button>
            </form>
          ))}
      </div>
    </div>
  );
}
