"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Download, Pencil, Search, Trash2, Wallet } from "lucide-react";
import * as XLSX from "xlsx";
import type { CommissionRow } from "../queries";
import {
  companyPaymentSchema,
  policySalesCommissionSchema,
  type CompanyPaymentValues,
  type PolicySalesCommissionValues,
} from "../schemas";
import {
  registerCompanyPaymentAction,
  deleteCompanyPaymentAction,
  updatePolicySalesCommissionAction,
} from "../actions";
import { formatMoney, type CurrencyCode, CURRENCIES } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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

export function CommissionsTable({
  rows,
  total,
  truncated,
  companies,
  lines,
  members,
  canManage,
  canEditRates,
}: {
  rows: CommissionRow[];
  total: number;
  truncated: boolean;
  companies: CatalogItem[];
  lines: CatalogItem[];
  members: { userId: string; name: string }[];
  canManage: boolean;
  canEditRates: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [paymentFor, setPaymentFor] = useState<CommissionRow | null>(null);
  const [editFor, setEditFor] = useState<CommissionRow | null>(null);

  const companyName = useMemo(
    () => new Map(companies.map((c) => [c.id, c.name])),
    [companies],
  );
  const lineName = useMemo(
    () => new Map(lines.map((l) => [l.id, l.name])),
    [lines],
  );
  const sellerName = useMemo(
    () => new Map(members.map((m) => [m.userId, m.name])),
    [members],
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
      "Comisión",
      "Pagado Cía",
      "Vendedor",
      "Liquidada",
    ];
    const body = rows.map((r) => [
      r.companyId ? (companyName.get(r.companyId) ?? "") : "",
      r.policyNumber,
      r.proposalNumber ?? "",
      STATUS_LABELS[r.status] ?? r.status,
      r.clientName,
      r.lineId ? (lineName.get(r.lineId) ?? "") : "",
      r.startDate ? new Date(r.startDate).toLocaleDateString("es-CL") : "",
      r.premiumNet ?? "",
      r.currency,
      r.brokerCommission,
      r.paidByCompany ? "Sí" : "No",
      r.salespersonId ? (sellerName.get(r.salespersonId) ?? "") : "",
      r.settled ? "Sí" : "No",
    ]);
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
          label="Vendedor"
          value={sel("salespersonId")}
          onChange={(v) => applyParams({ salespersonId: v })}
          options={members.map((m) => ({ value: m.userId, label: m.name }))}
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
              <TableHead className="text-right">Comisión</TableHead>
              <TableHead>Pagado Cía</TableHead>
              <TableHead>Vendedor</TableHead>
              {canManage ? <TableHead className="w-28" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 11 : 10}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No hay comisiones para los filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
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
                  <TableCell className="text-right text-sm">
                    {formatMoney(
                      r.brokerCommission,
                      r.currency as CurrencyCode,
                    )}
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
                  <TableCell className="text-sm text-muted-foreground">
                    {r.salespersonId
                      ? (sellerName.get(r.salespersonId) ?? "—")
                      : "—"}
                    {r.settled ? (
                      <span className="block text-xs text-emerald-600">
                        Liquidada
                      </span>
                    ) : null}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canEditRates ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar vendedor / % comisión"
                            onClick={() => setEditFor(r)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPaymentFor(r)}
                        >
                          <Wallet className="mr-1 size-4" /> Pago
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaymentDialog
        row={paymentFor}
        onClose={() => setPaymentFor(null)}
        onSaved={() => {
          setPaymentFor(null);
          router.refresh();
        }}
      />

      <OverrideDialog
        row={editFor}
        members={members}
        onClose={() => setEditFor(null)}
        onSaved={() => {
          setEditFor(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function OverrideDialog({
  row,
  members,
  onClose,
  onSaved,
}: {
  row: CommissionRow | null;
  members: { userId: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<PolicySalesCommissionValues>({
    salespersonId: "",
    salesCommissionPct: "",
  });

  useEffect(() => {
    if (row) {
      setValues({
        salespersonId: row.salespersonId ?? "",
        salesCommissionPct:
          row.salesCommissionPct != null ? String(row.salesCommissionPct) : "",
      });
    }
  }, [row]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!row) return;
    const parsed = policySalesCommissionSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    startTransition(async () => {
      const res = await updatePolicySalesCommissionAction(
        row.policyId,
        parsed.data,
      );
      if (res.ok) {
        toast.success("Vendedor / comisión actualizados");
        onSaved();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={Boolean(row)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Vendedor y comisión
            {row ? ` · Póliza ${row.policyNumber}` : ""}
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={onSubmit}>
          <Field label="Vendedor">
            <Select
              value={values.salespersonId === "" ? "none" : values.salespersonId}
              onValueChange={(v) =>
                setValues((s) => ({
                  ...s,
                  salespersonId: v === "none" ? "" : v,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin vendedor</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="% comisión vendedor (override)">
            <Input
              inputMode="decimal"
              placeholder="Vacío = tasa default del vendedor"
              value={values.salesCommissionPct}
              onChange={(e) =>
                setValues((s) => ({
                  ...s,
                  salesCommissionPct: e.target.value,
                }))
              }
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            Deja el % vacío para usar la tasa configurada del vendedor. Ingresa
            un valor para fijar un acuerdo especial en esta póliza.
          </p>
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

function PaymentDialog({
  row,
  onClose,
  onSaved,
}: {
  row: CommissionRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<CompanyPaymentValues>({
    policyId: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: "",
    currency: "CLP",
    invoiceNumber: "",
    exchangeFactor: "",
    notes: "",
  });

  useEffect(() => {
    if (row) {
      const pending = Math.max(row.brokerCommission - row.companyPaid, 0);
      setValues({
        policyId: row.policyId,
        paymentDate: new Date().toISOString().slice(0, 10),
        amount: pending > 0 ? String(pending) : "",
        currency: (row.currency as CurrencyCode) ?? "CLP",
        invoiceNumber: "",
        exchangeFactor: "",
        notes: "",
      });
    }
  }, [row]);

  function update<K extends keyof CompanyPaymentValues>(
    key: K,
    value: CompanyPaymentValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = companyPaymentSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    startTransition(async () => {
      const res = await registerCompanyPaymentAction(parsed.data);
      if (res.ok) {
        toast.success("Pago de compañía registrado");
        onSaved();
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
        onSaved();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={Boolean(row)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Registrar pago de compañía
            {row ? ` · Póliza ${row.policyNumber}` : ""}
          </DialogTitle>
        </DialogHeader>
        {row ? (
          <p className="text-sm text-muted-foreground">
            Comisión corredora:{" "}
            {formatMoney(row.brokerCommission, row.currency as CurrencyCode)} ·
            Pagado: {formatMoney(row.companyPaid, row.currency as CurrencyCode)}
          </p>
        ) : null}
        {row && row.payments.length > 0 ? (
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
          </div>
        ) : null}
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha de pago" required>
              <Input
                type="date"
                value={values.paymentDate}
                onChange={(e) => update("paymentDate", e.target.value)}
              />
            </Field>
            <Field label="Moneda">
              <Select
                value={values.currency}
                onValueChange={(v) => update("currency", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto" required>
              <Input
                inputMode="decimal"
                value={values.amount}
                onChange={(e) => update("amount", e.target.value)}
              />
            </Field>
            <Field label="N° Factura">
              <Input
                value={values.invoiceNumber}
                onChange={(e) => update("invoiceNumber", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Factor conversión (opcional)">
            <Input
              inputMode="decimal"
              placeholder="UF/USD → $"
              value={values.exchangeFactor}
              onChange={(e) => update("exchangeFactor", e.target.value)}
            />
          </Field>
          <Field label="Notas">
            <Input
              value={values.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Registrar pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
    <div className="space-y-1">
      <Label>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}
