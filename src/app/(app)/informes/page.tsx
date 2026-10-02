import Link from "next/link";
import { requireOrgDb } from "@/server/context";
import {
  getReportsSnapshot,
  reportFiltersFrom,
} from "@/features/reports/queries";
import { getCompanies } from "@/features/catalog/queries";
import { listOrgMembers } from "@/server/members";
import { canSeeAllClients } from "@/lib/roles";
import { AGING_BUCKETS } from "@/lib/domain/aging";
import { PageHeader } from "@/components/page-header";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { formatDate } from "@/lib/utils";

const MOVEMENT_LABELS: Record<string, string> = {
  ISSUE: "Emisión",
  ENDORSEMENT: "Endoso",
  REVERSAL: "Reverso",
};

const CLAIM_LABELS: Record<string, string> = {
  REPORTED: "Aviso recibido, no enviado",
  AWAITING_ASSIGNMENT: "Denunciado, espera asignación",
  IN_ADJUSTMENT: "En liquidación",
  PAYMENT_PROCESS: "Proceso de pago",
  CLOSED: "Cerrado",
  VOID: "Anulado",
};

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("es-CL", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

export default async function InformesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ctx, db } = await requireOrgDb();
  const sp = await searchParams;
  const filters = reportFiltersFrom(sp);
  const seesAll = canSeeAllClients(ctx.role);
  const [data, companies, members] = await Promise.all([
    getReportsSnapshot(ctx, db, filters),
    getCompanies(db),
    seesAll ? listOrgMembers(ctx.organizationId) : Promise.resolve([]),
  ]);
  const query = new URLSearchParams(
    Object.entries({
      mes: filters.mes,
      desde: filters.desde,
      hasta: filters.hasta,
      compania: filters.companyId,
      ejecutivo: filters.userId,
    }).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();
  const withQuery = (path: string) =>
    query ? `${path}${path.includes("?") ? "&" : "?"}${query}` : path;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Informes"
        description={`Los doce informes de ${data.periodLabel}. Cada cifra sale del libro, de la cartera o de la cuota, y la nota dice qué dato usa.`}
      />

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 text-sm"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Mes</span>
          <input
            type="month"
            name="mes"
            defaultValue={filters.mes ?? ""}
            className="rounded-md border bg-background px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Desde</span>
          <input
            type="date"
            name="desde"
            defaultValue={filters.desde ?? ""}
            className="rounded-md border bg-background px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Hasta</span>
          <input
            type="date"
            name="hasta"
            defaultValue={filters.hasta ?? ""}
            className="rounded-md border bg-background px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Compañía</span>
          <select
            name="compania"
            defaultValue={filters.companyId ?? ""}
            className="rounded-md border bg-background px-2 py-1.5"
          >
            <option value="">Todas</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
        {seesAll ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Ejecutivo</span>
            <select
              name="ejecutivo"
              defaultValue={filters.userId ?? ""}
              className="rounded-md border bg-background px-2 py-1.5"
            >
              <option value="">Todos</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="submit" className="rounded-md border px-3 py-1.5">
          Aplicar
        </button>
        {query ? (
          <Link href="/informes" className="text-xs text-primary hover:underline">
            Quitar filtros
          </Link>
        ) : null}
        <p className="w-full text-xs text-muted-foreground">
          Un rango desde–hasta manda sobre el mes. La cartera vigente y la mora
          son a hoy; el resto usa el período.
        </p>
      </form>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border bg-card p-4">
          <p className="text-2xl font-semibold">{data.portfolioCount}</p>
          <p className="text-xs text-muted-foreground">Pólizas vigentes</p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-2xl font-semibold">{pct(data.retentionRate)}</p>
          <p className="text-xs text-muted-foreground">
            Retención del período ({data.retention.renewed} de{" "}
            {data.retention.universe - data.retention.notRenewable})
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-2xl font-semibold">{data.retention.expiredUnmanaged}</p>
          <p className="text-xs text-muted-foreground">
            Vencidas sin gestionar en el período
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-2xl font-semibold">{data.claimsOpen}</p>
          <p className="text-xs text-muted-foreground">Siniestros abiertos</p>
        </article>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Catálogo R-01 a R-12</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {data.catalog.map((report) => (
            <article key={report.id} className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {report.id} · {report.title}
              </p>
              <p className="mt-1 text-sm">{report.question}</p>
              <p className="mt-2 text-sm font-medium">{report.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{report.note}</p>
              <a className="mt-2 inline-block text-xs underline" href={withQuery(`/api/informes/csv?codigo=${report.id}`)}>
                Descargar CSV
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Producción del período</h2>
        <p className="text-xs text-muted-foreground">
          Suma de los movimientos del libro con fecha de asiento en el período.
          Un reverso resta. La cartera vigente de abajo es el stock, no este flujo.
        </p>
        {data.production.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay movimientos en el período.</p>
        ) : (
          <ul className="divide-y text-sm">
            {data.production.map((row) => (
              <li
                key={`${row.currency}-${row.movementType}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>
                  {MOVEMENT_LABELS[row.movementType] ?? row.movementType}
                  <span className="ml-2 text-muted-foreground">
                    {row.currency} · {row.count}
                  </span>
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  Neta {formatMoney(row.net, row.currency as CurrencyCode)} · Bruta{" "}
                  {formatMoney(row.gross, row.currency as CurrencyCode)} · Comisión{" "}
                  {formatMoney(row.commission, row.currency as CurrencyCode)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Cartera vigente por moneda</h2>
        {data.premiumByCurrency.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay pólizas vigentes.</p>
        ) : (
          <ul className="divide-y text-sm">
            {data.premiumByCurrency.map((row) => (
              <li key={row.currency} className="flex justify-between py-2">
                <span>{row.currency}</span>
                <span>{formatMoney(row.amount, row.currency as CurrencyCode)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/polizas" className="text-sm text-primary hover:underline">
          Ver pólizas
        </Link>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Mora por antigüedad</h2>
          <a
            href={withQuery("/api/informes/mora.csv")}
            className="text-sm text-primary hover:underline"
          >
            Exportar CSV
          </a>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {AGING_BUCKETS.map((bucket) => (
            <div key={bucket} className="rounded-lg bg-muted/40 p-3">
              <p className="text-lg font-semibold">{data.aging[bucket].count}</p>
              <p className="text-xs text-muted-foreground">{bucket} días</p>
            </div>
          ))}
        </div>
        {data.agingRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay cuotas vencidas.</p>
        ) : (
          <ul className="divide-y text-sm">
            {data.agingRows.slice(0, 12).map((row) => (
              <li
                key={`${row.policyNumber}-${row.dueDate.toISOString()}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>
                  <span className="font-medium">{row.policyNumber}</span>
                  <span className="ml-2 text-muted-foreground">{row.clientName}</span>
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  {formatMoney(row.amount, row.currency as CurrencyCode)} ·{" "}
                  {row.daysLate} días · vence {formatDate(row.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/cobranza" className="text-sm text-primary hover:underline">
          Ir a cobranza
        </Link>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Comisiones pendientes por antigüedad</h2>
        <p className="text-xs text-muted-foreground">
          Días desde que se generó la comisión esperada (emisión o endoso) sin
          que la liquidación de la compañía la calce.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {AGING_BUCKETS.map((bucket) => (
            <div key={bucket} className="rounded-lg bg-muted/40 p-3">
              <p className="text-lg font-semibold">
                {data.pendingCommissionAging[bucket].count}
              </p>
              <p className="text-xs text-muted-foreground">{bucket} días</p>
              <p className="mt-1 text-xs">
                {data.pendingCommissionAging[bucket].byCurrency
                  .map((row) =>
                    formatMoney(row.amount, row.currency as CurrencyCode),
                  )
                  .join(" · ") || "—"}
              </p>
            </div>
          ))}
        </div>
        <Link href="/comisiones" className="text-sm text-primary hover:underline">
          Ir a comisiones
        </Link>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Siniestros por estado</h2>
        <p className="text-sm">
          Cierre a tiempo en el período: {pct(data.claimsClosedOnTime.rate)} (
          {data.claimsClosedOnTime.onTime} de {data.claimsClosedOnTime.withDeadline}{" "}
          con plazo)
        </p>
        {data.claimsByStatus.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay siniestros.</p>
        ) : (
          <ul className="divide-y text-sm">
            {data.claimsByStatus.map((row) => (
              <li key={row.status} className="flex justify-between py-2">
                <span>{CLAIM_LABELS[row.status] ?? row.status}</span>
                <span>{row.count}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/siniestros" className="text-sm text-primary hover:underline">
          Ver siniestros
        </Link>
      </section>
    </div>
  );
}
