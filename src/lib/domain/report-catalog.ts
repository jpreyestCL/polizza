/**
 * Los doce informes del MVP. Cada tarjeta dice la pregunta y la cifra que
 * el código puede calcular con los datos que existen. No inventa una tasa
 * cuando el estado no está en el modelo.
 */

import type {
  ClosedOnTime,
  CommissionAging,
  QuoteSuccess,
} from "@/lib/domain/report-metrics";

export type MoneyAmount = { currency: string; amount: number };

export type ReportCard = {
  id: string;
  title: string;
  question: string;
  value: string;
  note: string;
};

export type ReportCatalogInput = {
  production: { currency: string; net: number; gross: number; commission: number }[];
  portfolioCount: number;
  premiumByCurrency: MoneyAmount[];
  retentionRate: number | null;
  retentionUniverse: number;
  agingCount: number;
  paymentsInPeriod: number;
  expectedCommission: MoneyAmount[];
  allocatedCommission: number;
  pendingCommission: MoneyAmount[];
  claimsOpen: number;
  issuedInPeriod: number;
  issuedWithProblems: number;
  tasksCreated: number;
  tasksCompleted: number;
  tasksOverdue: number;
  quotationsByStatus: { status: string; count: number }[];
  pendingCommissionAging: CommissionAging;
  claimsClosedOnTime: ClosedOnTime;
  quoteSuccess: QuoteSuccess;
  quoteRequestsByStatus: { status: string; count: number }[];
  periodLabel: string;
  lossByCurrency: {
    currency: string;
    ratio: number | null;
    earned: number;
    indemnity: number;
  }[];
};

function num(value: number): string {
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 4 }).format(value);
}

function pct(value: number | null): string {
  if (value == null) return "sin dato";
  return new Intl.NumberFormat("es-CL", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function money(rows: MoneyAmount[]): string {
  if (rows.length === 0) return "0";
  return rows.map((row) => `${row.currency} ${num(row.amount)}`).join(" · ");
}

export function buildReportCatalog(input: ReportCatalogInput): ReportCard[] {
  const period = input.periodLabel;
  const issuanceRate =
    input.issuedInPeriod > 0
      ? input.issuedWithProblems / input.issuedInPeriod
      : null;
  const quotations =
    input.quotationsByStatus.length === 0
      ? "0"
      : input.quotationsByStatus
          .map((row) => `${row.status} ${row.count}`)
          .join(" · ");
  const requests =
    input.quoteRequestsByStatus.length === 0
      ? "0"
      : input.quoteRequestsByStatus
          .map((row) => `${row.status} ${row.count}`)
          .join(" · ");
  const pendingAging = Object.entries(input.pendingCommissionAging)
    .filter(([, slot]) => slot.count > 0)
    .map(([bucket, slot]) => `${bucket} días: ${money(slot.byCurrency)}`)
    .join(" · ");
  const loss =
    input.lossByCurrency.length === 0
      ? "sin prima devengada"
      : input.lossByCurrency
          .map(
            (row) =>
              `${row.currency} ${pct(row.ratio)} (devengada ${num(row.earned)}, indemnizado ${num(row.indemnity)})`,
          )
          .join(" · ");

  return [
    {
      id: "R-01",
      title: "Producción",
      question: "¿Cuánto emitimos en el período y cuánta comisión generó?",
      value:
        input.production.length === 0
          ? `Sin movimientos en ${period}`
          : input.production
              .map(
                (row) =>
                  `${row.currency} neta ${num(row.net)}, bruta ${num(row.gross)}, comisión ${num(row.commission)}`,
              )
              .join(" · "),
      note: `Suma del libro de primas con fecha de asiento en ${period}. Un reverso resta.`,
    },
    {
      id: "R-02",
      title: "Cartera vigente",
      question: "¿Qué tenemos vigente hoy?",
      value: `${input.portfolioCount} pólizas · prima neta ${money(input.premiumByCurrency)}`,
      note: "Stock de pólizas vigentes hoy. No es la producción del período.",
    },
    {
      id: "R-03",
      title: "Renovaciones del período",
      question: "¿Cuántas vencen, cuántas renovamos y cuántas perdimos?",
      value: `Retención ${pct(input.retentionRate)} · universo ${input.retentionUniverse}`,
      note: `Renovadas sobre las que vencen en ${period}, sin las no renovables.`,
    },
    {
      id: "R-04",
      title: "Mora por antigüedad",
      question: "¿Cuánto está vencido y desde cuándo?",
      value: `${input.agingCount} cuotas vencidas`,
      note: "Pendiente, parcial o rechazada con vencimiento anterior a hoy. El detalle está en la mora de esta misma página.",
    },
    {
      id: "R-05",
      title: "Pagos del período",
      question: "¿Qué cuotas se pagaron?",
      value: `${input.paymentsInPeriod} cuotas marcadas pagadas en ${period}`,
      note: "El grano es la cuota con estado pagada y fecha de pago en el período. No hay un registro de pago aparte de la cuota.",
    },
    {
      id: "R-06",
      title: "Comisiones: esperado frente a cobrado",
      question: "¿Nos pagan lo que corresponde?",
      value: `Esperada ${money(input.expectedCommission)} · imputada ${num(input.allocatedCommission)}`,
      note: "La esperada sale de los receivables del período que no están anulados. Lo imputado es la suma de calces del período y no trae moneda propia.",
    },
    {
      id: "R-07",
      title: "Comisiones pendientes",
      question: "¿Qué nos debe cada compañía?",
      value: `${money(input.pendingCommission)}${pendingAging ? ` · ${pendingAging}` : ""}`,
      note: "Receivables en estado pendiente, por antigüedad desde que se generó la comisión (emisión o endoso).",
    },
    {
      id: "R-08",
      title: "Siniestros y SLA",
      question: "¿Cómo va el servicio de siniestros?",
      value: `${input.claimsOpen} abiertos · cierre a tiempo ${pct(input.claimsClosedOnTime.rate)} (${input.claimsClosedOnTime.onTime} de ${input.claimsClosedOnTime.withDeadline})`,
      note: `Abiertos son todos los que no están cerrados. A tiempo: cerrados en el período el día del plazo de cierre o antes; ${input.claimsClosedOnTime.closed - input.claimsClosedOnTime.withDeadline} cerrados sin plazo no entran.`,
    },
    {
      id: "R-09",
      title: "Calidad de emisión",
      question: "¿Qué se emitió con problemas?",
      value: `${pct(issuanceRate)} · ${input.issuedWithProblems} de ${input.issuedInPeriod}`,
      note: "Pólizas creadas en el período con marca de problema, sobre las pólizas creadas en el período. La fecha es la de alta en cartera.",
    },
    {
      id: "R-10",
      title: "Trabajo del equipo",
      question: "¿Quién tiene atrasos y cuánto se hizo?",
      value: `Creadas ${input.tasksCreated} · completadas ${input.tasksCompleted} · atrasadas ${input.tasksOverdue}`,
      note: "Completada usa la fecha de actualización de la tarea. No hay una fecha de cierre distinta.",
    },
    {
      id: "R-11",
      title: "Embudo de cotizaciones",
      question: "¿Cuánto cotizamos y ganamos?",
      value: `Éxito ${pct(input.quoteSuccess.rate)} (${input.quoteSuccess.won} ganadas, ${input.quoteSuccess.lost} perdidas) · solicitudes ${requests} · auto ${quotations}`,
      note: "Tasa de éxito = solicitudes de cotización ganadas sobre ganadas más perdidas, creadas en el período. La cotización de auto se cuenta aparte.",
    },
    {
      id: "R-12",
      title: "Siniestralidad",
      question: "¿Cuánto nos cuesta cada cartera?",
      value: loss,
      note: "Devengado a hoy con la prorrata de la vigencia, por moneda. Indemnizado = monto liquidado de lo pagado más estimado de lo abierto.",
    },
  ];
}
