"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Pencil,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import * as XLSX from "xlsx";
import type { CommissionRow } from "../queries";
import {
  companyPaymentSchema,
  policyCommissionSchema,
  type CompanyPaymentValues,
  type PaymentDecision,
  type PolicyCommissionValues,
} from "../schemas";
import {
  registerCompanyPaymentAction,
  deleteCompanyPaymentAction,
  setCommissionPaidAction,
  updatePolicyCommissionAction,
} from "../actions";
import {
  brokerCommissionOf,
  evaluateCompanyPayment,
  COMMISSION_TOLERANCE_PCT,
} from "@/lib/commissions";
import {
  formatMoney,
  parseLocaleNumber,
  type CurrencyCode,
} from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABELS: Record<string, string> = {
  VIGENTE: "Vigente",
  VENCIDA: "Vencida",
  RENOVADA: "Renovada",
  CANCELADA: "Cancelada",
  ANULADA: "Anulada",
};

type CatalogItem = { id: string; name: string };

/** Factores de conversión (valor en $ de 1 unidad) por moneda de póliza. */
type Factors = { UF: string; USD: string; EUR: string; UD: string };

export type Indicators = {
  uf: number | null;
  usdObs: number | null;
  euro: number | null;
};

function factorKey(currency: string): keyof Factors | null {
  if (currency === "UF") return "UF";
  if (currency === "USD" || currency === "USD_OBS") return "USD";
  if (currency === "EUR") return "EUR";
  if (currency === "UD") return "UD";
  return null;
}

function referenceRate(currency: string, indicators: Indicators): number | null {
  if (currency === "UF") return indicators.uf;
  if (currency === "USD" || currency === "USD_OBS") return indicators.usdObs;
  if (currency === "EUR") return indicators.euro;
  return null;
}

function factorFor(currency: string, factors: Factors): number | null {
  if (currency === "CLP") return 1;
  const key = factorKey(currency);
  if (!key) return null;
  const value = parseLocaleNumber(factors[key]);
  return value && value > 0 ? value : null;
}

function fmtRate(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("es-CL", { maximumFractionDigits: 3 })}%`;
}

function toInput(value: number | null): string {
  return value == null ? "" : String(value);
}

export function CommissionsTable({
  rows,
  total,
  truncated,
  companies,
  lines,
  indicators,
  canManage,
}: {
  rows: CommissionRow[];
  total: number;
  truncated: boolean;
  companies: CatalogItem[];
  lines: CatalogItem[];
  indicators: Indicators;
  canManage: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [paymentForId, setPaymentForId] = useState<string | null>(null);
  const [editForId, setEditForId] = useState<string | null>(null);
  const [factors, setFactors] = useState<Factors>({
    UF: toInput(indicators.uf),
    USD: toInput(indicators.usdObs),
    EUR: toInput(indicators.euro),
    UD: "",
  });

  // Se guardan ids (no filas) para que tras router.refresh() el diálogo
  // abierto muestre los datos actualizados de la póliza.
  const paymentFor = rows.find((r) => r.policyId === paymentForId) ?? null;
  const editFor = rows.find((r) => r.policyId === editForId) ?? null;

  const companyName = useMemo(
    () => new Map(companies.map((c) => [c.id, c.name])),
    [companies],
  );
  const lineName = useMemo(
    () => new Map(lines.map((l) => [l.id, l.name])),
    [lines],
  );

  const applyParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "all") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const urlQuery = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(urlQuery);
  useEffect(() => setSearch(urlQuery), [urlQuery]);
  useEffect(() => {
    if (search === urlQuery) return;
    const t = setTimeout(() => applyParams({ q: search || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function exportExcel() {
    const header = [
      "Compañía",
      "N° Póliza",
      "N° Prop.",
      "Estado",
      "Contratante",
      "Ramo",
      "Inicio Vig.",
      "Prima Neta",
      "Moneda",
      "% Comisión",
      "Comisión calculada",
      "Conversión",
      "Comisión ($)",
      "Pagado Cía ($)",
      "Saldo (moneda póliza)",
      "Pagado Cía",
    ];
    const body = rows.map((r) => {
      const factor = factorFor(r.currency, factors);
      return [
        r.companyId ? (companyName.get(r.companyId) ?? "") : "",
        r.policyNumber,
        r.proposalNumber ?? "",
        STATUS_LABELS[r.status] ?? r.status,
        r.clientName,
        r.lineId ? (lineName.get(r.lineId) ?? "") : "",
        r.startDate ? new Date(r.startDate).toLocaleDateString("es-CL") : "",
        r.premiumNet ?? "",
        r.currency,
        r.commissionPercent ?? "",
        r.brokerCommission,
        factor ?? "",
        factor != null ? Math.round(r.brokerCommission * factor) : "",
        r.companyPaidClp,
        r.pendingCommission,
        r.paidByCompany ? "Sí" : "No",
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comisiones");
    XLSX.writeFile(
      wb,
      `comisiones-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  const sel = (key: string) => searchParams.get(key) ?? "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="w-56 pl-8"
              placeholder="N° póliza o contratante"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <FilterSelect
          label="Compañía"
          value={sel("companyId")}
          onChange={(v) => applyParams({ companyId: v })}
          options={companies.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          label="Ramo"
          value={sel("lineId")}
          onChange={(v) => applyParams({ lineId: v })}
          options={lines.map((l) => ({ value: l.id, label: l.name }))}
        />
        <FilterSelect
          label="Estado"
          value={sel("status")}
          onChange={(v) => applyParams({ status: v })}
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <FilterSelect
          label="Pagado Cía"
          value={sel("pagado")}
          onChange={(v) => applyParams({ pagado: v })}
          options={[
            { value: "SI", label: "Sí" },
            { value: "NO", label: "No" },
          ]}
        />
        <div className="space-y-1">
          <Label className="text-xs">Vig. desde</Label>
          <Input
            type="date"
            className="w-36"
            value={searchParams.get("desde") ?? ""}
            onChange={(e) => applyParams({ desde: e.target.value || null })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Vig. hasta</Label>
          <Input
            type="date"
            className="w-36"
            value={searchParams.get("hasta") ?? ""}
            onChange={(e) => applyParams({ hasta: e.target.value || null })}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={exportExcel}
          disabled={rows.length === 0}
        >
          <Download className="mr-2 size-4" /> Llevar a Excel
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="text-sm font-medium">Factor de conversión ($)</div>
        {(["UF", "USD", "EUR", "UD"] as const).map((key) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs">{key}</Label>
            <Input
              className="h-8 w-28"
              inputMode="decimal"
              value={factors[key]}
              onChange={(e) =>
                setFactors((f) => ({ ...f, [key]: e.target.value }))
              }
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Precargado con los indicadores del día. Se usa para expresar la
          comisión calculada en pesos.
        </p>
      </div>

      <div className="text-sm text-muted-foreground">
        {total} {total === 1 ? "registro" : "registros"}
        {truncated ? " (mostrando los primeros 2000, refina los filtros)" : ""}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compañía</TableHead>
              <TableHead>N° Póliza</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Contratante</TableHead>
              <TableHead>Ramo</TableHead>
              <TableHead>Inicio Vig.</TableHead>
              <TableHead className="text-right">Prima Neta</TableHead>
              <TableHead className="text-right">Comisión calculada</TableHead>
              <TableHead className="text-right">Conversión</TableHead>
              <TableHead className="text-right">Comisión ($)</TableHead>
              <TableHead className="text-right">Pagado Cía ($)</TableHead>
              <TableHead>Pagado Cía</TableHead>
              {canManage ? <TableHead className="w-32" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 13 : 12}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No hay comisiones para los filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const factor = factorFor(r.currency, factors);
                return (
                  <TableRow key={r.policyId}>
                    <TableCell className="text-sm">
                      {r.companyId ? (companyName.get(r.companyId) ?? "—") : "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/polizas/${r.policyId}`}
                        className="hover:text-primary"
                      >
                        {r.policyNumber}
                      </Link>
                      {r.proposalNumber ? (
                        <span className="block text-xs text-muted-foreground">
                          Prop. {r.proposalNumber}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {STATUS_LABELS[r.status] ?? r.status}
                    </TableCell>
                    <TableCell className="text-sm">{r.clientName}</TableCell>
                    <TableCell className="text-sm">
                      {r.lineId ? (lineName.get(r.lineId) ?? "—") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.startDate
                        ? new Date(r.startDate).toLocaleDateString("es-CL")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatMoney(r.premiumNet, r.currency as CurrencyCode)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatMoney(
                        r.brokerCommission,
                        r.currency as CurrencyCode,
                      )}
                      {r.commissionPercent != null ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {fmtPct(r.commissionPercent)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.currency === "CLP" ? "—" : fmtRate(factor)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {factor != null
                        ? formatMoney(r.brokerCommission * factor, "CLP")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.companyPaidClp > 0
                        ? formatMoney(r.companyPaidClp, "CLP")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {r.paidByCompany ? (
                        <Badge>Pagado</Badge>
                      ) : r.companyPaid > 0 ? (
                        <Badge variant="secondary">Parcial</Badge>
                      ) : (
                        <Badge variant="outline">Pendiente</Badge>
                      )}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Corregir prima / comisión de la póliza"
                            onClick={() => setEditForId(r.policyId)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPaymentForId(r.policyId)}
                          >
                            <Wallet className="mr-1 size-4" /> Pago
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <PaymentDialog
        row={paymentFor}
        companyName={
          paymentFor?.companyId
            ? (companyName.get(paymentFor.companyId) ?? null)
            : null
        }
        defaultRate={paymentFor ? factorFor(paymentFor.currency, factors) : null}
        indicators={indicators}
        onClose={() => setPaymentForId(null)}
        onEditCommission={() => {
          if (paymentFor) setEditForId(paymentFor.policyId);
        }}
        onSaved={() => {
          setPaymentForId(null);
          router.refresh();
        }}
        onChanged={() => router.refresh()}
      />

      <CommissionEditDialog
        row={editFor}
        onClose={() => setEditForId(null)}
        onSaved={() => {
          setEditForId(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type PaymentForm = {
  paymentDate: string;
  currency: string;
  rate: string;
  amount: string;
  invoiceNumber: string;
  invoiceDate: string;
  notes: string;
};

/**
 * Registro del pago de la compañía. Muestra la comisión calculada en la moneda
 * de la póliza, permite ingresar el tipo de cambio que informa la compañía (o
 * deduce el que usó a partir del monto pagado), calcula el monto en pesos que
 * debería recibir y compara contra lo liquidado. Con diferencia fuera del
 * margen, se decide si dejar la comisión pagada o registrar el pago y dejarla
 * pendiente (para reclamar el saldo a la compañía).
 */
function PaymentDialog({
  row,
  companyName,
  defaultRate,
  indicators,
  onClose,
  onEditCommission,
  onSaved,
  onChanged,
}: {
  row: CommissionRow | null;
  companyName: string | null;
  defaultRate: number | null;
  indicators: Indicators;
  onClose: () => void;
  onEditCommission: () => void;
  onSaved: () => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<PaymentForm>({
    paymentDate: new Date().toISOString().slice(0, 10),
    currency: "CLP",
    rate: "",
    amount: "",
    invoiceNumber: "",
    invoiceDate: "",
    notes: "",
  });

  const rowId = row?.policyId ?? null;
  useEffect(() => {
    if (!row) return;
    setValues({
      paymentDate: new Date().toISOString().slice(0, 10),
      currency: "CLP",
      rate: "",
      amount: "",
      invoiceNumber: "",
      invoiceDate: "",
      notes: "",
    });
    // Solo al abrir el diálogo para otra póliza: no pisar lo tipeado cuando
    // la fila se refresca tras un cambio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId]);

  function update<K extends keyof PaymentForm>(key: K, value: PaymentForm[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const policyCurrency = (row?.currency ?? "UF") as CurrencyCode;
  const sameCurrency = values.currency === policyCurrency;
  const due = row?.pendingCommission ?? 0;
  const enteredRate = parseLocaleNumber(values.rate);
  const paidAmount = parseLocaleNumber(values.amount);
  const reference = row
    ? (defaultRate ?? referenceRate(row.currency, indicators))
    : null;

  const evaluation = evaluateCompanyPayment({
    due,
    paidAmount,
    enteredRate,
    referenceRate: reference,
    sameCurrency,
  });
  const paymentCurrency = values.currency as CurrencyCode;

  function submit(decision: PaymentDecision) {
    if (!row) return;
    if (paidAmount == null || paidAmount <= 0) {
      toast.error("Ingresa el monto pagado por la compañía.");
      return;
    }
    // Tipo de cambio que se guarda con el pago: el informado por la compañía;
    // si no lo informó, el de referencia (así un pago de menos queda como
    // saldo pendiente real) o, a falta de ambos, el implícito.
    const rateToStore = sameCurrency ? null : evaluation.rateUsed;
    const payload: CompanyPaymentValues = {
      policyId: row.policyId,
      paymentDate: values.paymentDate,
      amount: String(paidAmount),
      currency: values.currency,
      invoiceNumber: values.invoiceNumber,
      invoiceDate: values.invoiceDate,
      exchangeFactor: rateToStore != null ? String(round4(rateToStore)) : "",
      notes: values.notes,
      decision,
    };
    const parsed = companyPaymentSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    startTransition(async () => {
      const res = await registerCompanyPaymentAction(parsed.data);
      if (res.ok) {
        toast.success(
          decision === "PAID"
            ? "Pago registrado y comisión dejada como pagada"
            : "Pago registrado; la comisión queda pendiente",
        );
        onSaved();
      } else {
        toast.error(res.error);
      }
    });
  }

  function setPaidStatus(paid: boolean | null) {
    if (!row) return;
    startTransition(async () => {
      const res = await setCommissionPaidAction(row.policyId, paid);
      if (res.ok) {
        toast.success(
          paid ? "Comisión dejada como pagada" : "Comisión dejada pendiente",
        );
        onChanged();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onDeletePayment(id: string) {
    if (!confirm("¿Eliminar este pago de compañía?")) return;
    startTransition(async () => {
      const res = await deleteCompanyPaymentAction(id);
      if (res.ok) {
        toast.success("Pago eliminado");
        onChanged();
      } else {
        toast.error(res.error);
      }
    });
  }

  const suggestPaid = evaluation.verdict !== "under";

  return (
    <Dialog open={Boolean(row)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Pago de comisión{row ? ` · Póliza ${row.policyNumber}` : ""}
          </DialogTitle>
          {row ? (
            <DialogDescription>
              {row.clientName}
              {companyName ? ` · ${companyName}` : ""}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {row ? (
          <>
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-4">
              <Stat
                label="Prima neta"
                value={formatMoney(row.premiumNet, policyCurrency)}
              />
              <Stat label="% comisión" value={fmtPct(row.commissionPercent)} />
              <Stat
                label="Comisión calculada"
                value={formatMoney(row.brokerCommission, policyCurrency)}
                strong
              />
              <Stat
                label="Pendiente"
                value={formatMoney(row.pendingCommission, policyCurrency)}
                strong
              />
              <Stat
                label="Ya pagado"
                value={`${formatMoney(row.companyPaid, policyCurrency)}${
                  row.companyPaidClp > 0
                    ? ` · ${formatMoney(row.companyPaidClp, "CLP")}`
                    : ""
                }`}
              />
              <Stat
                label="Estado"
                value={
                  row.paidByCompany
                    ? "Pagada"
                    : row.companyPaid > 0
                      ? "Pago parcial"
                      : "Pendiente"
                }
              />
              <div className="col-span-2 flex flex-wrap items-end justify-end gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/polizas/${row.policyId}`} target="_blank">
                    <ExternalLink className="mr-1 size-4" /> Ver póliza
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onEditCommission}
                >
                  <Pencil className="mr-1 size-4" /> Corregir comisión
                </Button>
              </div>
            </div>

            {row.payments.length > 0 ? (
              <div className="space-y-1 rounded-md border p-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Pagos registrados
                </p>
                {row.payments.map((pmt) => (
                  <div
                    key={pmt.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      {new Date(pmt.paymentDate).toLocaleDateString("es-CL")} ·{" "}
                      {formatMoney(pmt.amount, pmt.currency as CurrencyCode)}
                      {pmt.exchangeFactor
                        ? ` · TC ${fmtRate(pmt.exchangeFactor)}`
                        : ""}
                      {pmt.invoiceNumber ? ` · Fact. ${pmt.invoiceNumber}` : ""}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      onClick={() => onDeletePayment(pmt.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex justify-end gap-2 pt-1">
                  {row.paidByCompany ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => setPaidStatus(false)}
                    >
                      Dejar pendiente
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => setPaidStatus(true)}
                    >
                      <CheckCircle2 className="mr-1 size-4" /> Dejar pagado
                      sin nuevo pago
                    </Button>
                  )}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Moneda del pago">
                  <Select
                    value={values.currency}
                    onValueChange={(v) => update("currency", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLP">CLP ($)</SelectItem>
                      {policyCurrency !== "CLP" ? (
                        <SelectItem value={policyCurrency}>
                          {policyCurrency}
                        </SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                </Field>
                {!sameCurrency ? (
                  <Field label={`Tipo de cambio ${policyCurrency} → $`}>
                    <Input
                      inputMode="decimal"
                      placeholder="Informado por la cía"
                      value={values.rate}
                      onChange={(e) => update("rate", e.target.value)}
                    />
                    {reference != null ? (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => update("rate", String(reference))}
                      >
                        Usar {fmtRate(reference)}
                      </button>
                    ) : null}
                  </Field>
                ) : null}
                <Field
                  label={`Debería recibir (${sameCurrency ? policyCurrency : "$"})`}
                >
                  <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
                    {evaluation.expectedAmount != null
                      ? formatMoney(evaluation.expectedAmount, paymentCurrency)
                      : "—"}
                  </div>
                  {evaluation.rateSource === "reference" ? (
                    <span className="text-xs text-muted-foreground">
                      Con TC de referencia {fmtRate(evaluation.rateUsed)}
                    </span>
                  ) : null}
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field
                  label={`Monto pagado por la cía (${sameCurrency ? policyCurrency : "$"})`}
                  required
                >
                  <Input
                    inputMode="decimal"
                    value={values.amount}
                    onChange={(e) => update("amount", e.target.value)}
                  />
                  {evaluation.expectedAmount != null &&
                  evaluation.expectedAmount > 0 ? (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() =>
                        update(
                          "amount",
                          String(
                            sameCurrency
                              ? evaluation.expectedAmount
                              : Math.round(evaluation.expectedAmount ?? 0),
                          ),
                        )
                      }
                    >
                      Igual a lo calculado
                    </button>
                  ) : null}
                </Field>
                {!sameCurrency ? (
                  <Field label="TC utilizado por la cía">
                    <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
                      {evaluation.impliedRate != null
                        ? fmtRate(evaluation.impliedRate)
                        : "—"}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Monto pagado ÷ comisión pendiente
                    </span>
                  </Field>
                ) : null}
                <Field label="Fecha imputación del pago" required>
                  <Input
                    type="date"
                    value={values.paymentDate}
                    onChange={(e) => update("paymentDate", e.target.value)}
                  />
                </Field>
              </div>

              <DifferenceNotice
                evaluation={evaluation}
                currency={paymentCurrency}
              />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="N° Factura">
                  <Input
                    value={values.invoiceNumber}
                    onChange={(e) => update("invoiceNumber", e.target.value)}
                  />
                </Field>
                <Field label="Fecha factura">
                  <Input
                    type="date"
                    value={values.invoiceDate}
                    onChange={(e) => update("invoiceDate", e.target.value)}
                  />
                </Field>
                <Field label="Notas">
                  <Input
                    value={values.notes}
                    onChange={(e) => update("notes", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={suggestPaid ? "outline" : "default"}
            disabled={pending}
            onClick={() => submit("PENDING")}
          >
            Registrar pago y dejar pendiente
          </Button>
          <Button
            type="button"
            variant={suggestPaid ? "default" : "outline"}
            disabled={pending}
            onClick={() => submit("PAID")}
          >
            {pending ? "Guardando…" : "Dejar pagado por compañía"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function DifferenceNotice({
  evaluation,
  currency,
}: {
  evaluation: ReturnType<typeof evaluateCompanyPayment>;
  currency: CurrencyCode;
}) {
  if (evaluation.verdict == null || evaluation.difference == null) return null;
  const diff = formatMoney(Math.abs(evaluation.difference), currency);
  const pct =
    evaluation.differencePct != null
      ? ` (${evaluation.differencePct > 0 ? "+" : ""}${evaluation.differencePct.toLocaleString("es-CL")}%)`
      : "";
  if (evaluation.verdict === "ok") {
    return (
      <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        El pago coincide con la comisión calculada
        {evaluation.difference !== 0 ? ` (diferencia ${diff}${pct})` : ""},
        dentro del margen de ±{COMMISSION_TOLERANCE_PCT}%.
      </div>
    );
  }
  if (evaluation.verdict === "under") {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        La compañía pagó <strong>{diff} menos</strong>
        {pct} de lo calculado. Revisa si falta pagar parte de la prima o si el %
        de comisión está mal fijado (en la compañía o en la póliza). Si
        corresponde reclamar, registra el pago y deja la comisión{" "}
        <strong>pendiente</strong>: la compañía solo debe pagar el saldo.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200">
      La compañía pagó <strong>{diff} más</strong>
      {pct} de lo calculado. Revisa que la comisión de la póliza esté bien
      registrada; si está correcta puedes dejarla pagada.
    </div>
  );
}

/**
 * Corrección de la comisión de la póliza (prima neta, % o monto fijo) cuando la
 * diferencia con lo pagado se debe a un dato mal registrado en el sistema.
 */
function CommissionEditDialog({
  row,
  onClose,
  onSaved,
}: {
  row: CommissionRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<PolicyCommissionValues>({
    premiumNet: "",
    commissionPercent: "",
    commissionAmount: "",
  });

  const rowId = row?.policyId ?? null;
  useEffect(() => {
    if (!row) return;
    setValues({
      premiumNet: toInput(row.premiumNet),
      commissionPercent: toInput(row.commissionPercent),
      commissionAmount: toInput(row.commissionAmount),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId]);

  const preview = brokerCommissionOf({
    premiumNet: parseLocaleNumber(values.premiumNet),
    commissionPercent: parseLocaleNumber(values.commissionPercent),
    commissionAmount: parseLocaleNumber(values.commissionAmount),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!row) return;
    const normalize = (v: string) => {
      const n = parseLocaleNumber(v);
      return n == null ? "" : String(n);
    };
    const parsed = policyCommissionSchema.safeParse({
      premiumNet: normalize(values.premiumNet),
      commissionPercent: normalize(values.commissionPercent),
      commissionAmount: normalize(values.commissionAmount),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    startTransition(async () => {
      const res = await updatePolicyCommissionAction(row.policyId, parsed.data);
      if (res.ok) {
        toast.success("Comisión de la póliza actualizada");
        onSaved();
      } else {
        toast.error(res.error);
      }
    });
  }

  const currency = (row?.currency ?? "UF") as CurrencyCode;

  return (
    <Dialog open={Boolean(row)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Corregir comisión{row ? ` · Póliza ${row.policyNumber}` : ""}
          </DialogTitle>
          <DialogDescription>
            Úsalo cuando la diferencia con lo pagado por la compañía se debe a
            un dato mal registrado en el sistema. Montos en {currency}.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Prima neta (${currency})`}>
              <Input
                inputMode="decimal"
                value={values.premiumNet}
                onChange={(e) =>
                  setValues((v) => ({ ...v, premiumNet: e.target.value }))
                }
              />
            </Field>
            <Field label="% comisión">
              <Input
                inputMode="decimal"
                value={values.commissionPercent}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    commissionPercent: e.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <Field label={`Monto comisión fijo (${currency})`}>
            <Input
              inputMode="decimal"
              placeholder="Vacío = prima neta × %"
              value={values.commissionAmount}
              onChange={(e) =>
                setValues((v) => ({ ...v, commissionAmount: e.target.value }))
              }
            />
          </Field>
          <p className="text-sm">
            Comisión resultante:{" "}
            <strong>{formatMoney(preview, currency)}</strong>
          </p>
          {row ? (
            <Link
              href={`/polizas/${row.policyId}/editar`}
              target="_blank"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" /> Editar la póliza completa
            </Link>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={strong ? "font-semibold" : undefined}>{value}</div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}
