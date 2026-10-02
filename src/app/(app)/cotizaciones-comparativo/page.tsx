import Link from "next/link";
import { requireOrgDb } from "@/server/context";
import { listClientsForSelect } from "@/features/clients/queries";
import { createQuoteRequestAction } from "@/features/quotes/actions";
import { PageHeader } from "@/components/page-header";

const LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  SOLICITADA: "Solicitada",
  COTIZADA: "Cotizada",
  ENVIADA_CLIENTE: "Enviada al cliente",
  GANADA: "Ganada",
  PERDIDA: "Perdida",
};

export default async function CotizacionesComparativoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { ctx, db } = await requireOrgDb();
  const [rows, clients] = await Promise.all([
    db.quoteRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { client: { select: { name: true } }, offers: { select: { id: true } } },
    }),
    listClientsForSelect(ctx, db),
  ]);
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cotizaciones"
        description="Pedido de precio a varias compañías. Si el cliente acepta, nace una propuesta en elaboración. La cotización de auto sigue en su propia pantalla."
      />
      {error ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          No se pudo crear la solicitud. Revisa el cliente y el título.
        </p>
      ) : null}
      <form action={createQuoteRequestAction} className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-4">
        <label className="flex min-w-56 flex-col gap-1 text-sm">
          Cliente
          <select name="clientId" required className="rounded-md border bg-background px-2 py-1.5">
            <option value="">Elegir</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
          Qué se cotiza
          <input name="title" required minLength={3} className="rounded-md border bg-background px-2 py-1.5" />
        </label>
        <button type="submit" className="rounded-md border px-3 py-2 text-sm">Crear solicitud</button>
      </form>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay solicitudes.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <Link href={`/cotizaciones-comparativo/${row.id}`} className="font-medium hover:underline">
                {row.title}
              </Link>
              <span className="text-muted-foreground">
                {row.client.name} · {LABEL[row.status] ?? row.status} · {row.offers.length} ofertas
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
