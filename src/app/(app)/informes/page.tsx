import Link from "next/link";
import { requireOrgDb } from "@/server/context";
import { getReportsSnapshot } from "@/features/reports/queries";
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
  REPORTADO: "Reportado",
  INGRESADO_COMPANIA: "Ingresado en compañía",
  EN_EVALUACION: "En evaluación",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  PAGADO: "Pagado",
  CERRADO: "Cerrado",
};

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("es-CL", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

export default async function InformesPage() {
  const { ctx, db } = await requireOrgDb();
  const data = await getReportsSnapshot(ctx, db);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Informes"
        description="Producción del mes desde el libro de primas, cartera vigente, retención, mora y siniestros. Cada cifra sale de la misma definición que usa la operación."
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border bg-card p-4">
          <p className="text-2xl font-semibold">{data.portfolioCount}</p>
          <p className="text-xs text-muted-foreground">Pólizas vigentes</p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-2xl font-semibold">{pct(data.retentionRate)}</p>
          <p className="text-xs text-muted-foreground">
            Retención del mes ({data.retention.renewed} de{" "}
            {data.retention.universe - data.retention.notRenewable})
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-2xl font-semibold">{data.retention.expiredUnmanaged}</p>
          <p className="text-xs text-muted-foreground">
            Vencidas sin gestionar en el mes
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-2xl font-semibold">{data.claimsOpen}</p>
          <p className="text-xs text-muted-foreground">Siniestros abiertos</p>
        </article>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Producción del mes</h2>
        <p className="text-xs text-muted-foreground">
          Suma de los movimientos del libro con fecha de asiento en el mes.
          Un reverso resta. La cartera vigente de abajo es el stock, no este flujo.
        </p>
        {data.production.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay movimientos en el mes.</p>
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
            href="/api/informes/mora.csv"
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
        <h2 className="text-sm font-semibold">Siniestros por estado</h2>
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
