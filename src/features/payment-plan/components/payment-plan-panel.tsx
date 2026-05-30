"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  UserCheck,
} from "lucide-react";
import { upsertPaymentPlanAction } from "../actions";
import {
  paymentPlanSchema,
  PAYMENT_OPTIONS,
  PAYMENT_OPTION_LABELS,
  type PaymentPlanValues,
} from "../schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Plan = {
  sinPlanDePago: boolean;
  option: string | null;
  installmentsCount: number;
  observations: string | null;
  documented: boolean;
  firstPaymentDate: Date | null;
  firstSignDate: Date | null;
  valorCuota: number | null;
  cobrAnticipada: boolean;
  facturaAnticipada: boolean;
  requiereFactura: boolean;
  primaBruta: number | null;
  cambio: number | null;
  primaTotalPesos: number | null;
  payerRut: string | null;
  payerName: string | null;
  payerLastName: string | null;
  payerLegalName: string | null;
  payerPhone: string | null;
  payerCelular: string | null;
  payerEmail: string | null;
};

export type PaymentIndicators = {
  uf: number | null;
  usdObs: number | null;
  euro: number | null;
};

export type PayerContratante = {
  rut: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  legalName: string | null;
  phone: string | null;
  celular: string | null;
  email: string | null;
};

/** Tipo de cambio (a pesos) según la moneda de la propuesta y los indicadores. */
export function exchangeRateForCurrency(
  currency: string,
  indicators: PaymentIndicators,
): number | null {
  switch (currency) {
    case "CLP":
      return 1;
    case "UF":
      return indicators.uf;
    case "USD":
    case "USD_OBS":
      return indicators.usdObs;
    case "EUR":
      return indicators.euro;
    default:
      return null;
  }
}

export function PaymentPlanPanel({
  proposalId,
  plan,
  currency,
  proposalGrossPremium = 0,
  indicators = { uf: null, usdObs: null, euro: null },
  contratante = null,
}: {
  proposalId: string;
  plan: Plan | null;
  currency: string;
  proposalGrossPremium?: number;
  indicators?: PaymentIndicators;
  contratante?: PayerContratante | null;
}) {
  const [open, setOpen] = useState(false);

  const initial: PaymentPlanValues = plan
    ? {
        sinPlanDePago: plan.sinPlanDePago,
        option: (plan.option as PaymentPlanValues["option"]) ?? undefined,
        installmentsCount: String(plan.installmentsCount ?? 0),
        observations: plan.observations ?? "",
        documented: plan.documented,
        firstPaymentDate: dateInput(plan.firstPaymentDate),
        firstSignDate: dateInput(plan.firstSignDate),
        valorCuota: plan.valorCuota !== null ? String(plan.valorCuota) : "",
        cobrAnticipada: plan.cobrAnticipada,
        facturaAnticipada: plan.facturaAnticipada,
        requiereFactura: plan.requiereFactura,
        primaBruta: plan.primaBruta !== null ? String(plan.primaBruta) : "",
        cambio: plan.cambio !== null ? String(plan.cambio) : "",
        primaTotalPesos:
          plan.primaTotalPesos !== null ? String(plan.primaTotalPesos) : "",
        payerRut: plan.payerRut ?? "",
        payerName: plan.payerName ?? "",
        payerLastName: plan.payerLastName ?? "",
        payerLegalName: plan.payerLegalName ?? "",
        payerPhone: plan.payerPhone ?? "",
        payerCelular: plan.payerCelular ?? "",
        payerEmail: plan.payerEmail ?? "",
        generateInstallments: false,
      }
    : EMPTY;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Plan de pago</h2>
          {plan?.sinPlanDePago && <Badge variant="muted">Sin plan</Badge>}
          {plan?.option && !plan.sinPlanDePago && (
            <Badge variant="secondary">
              {PAYMENT_OPTION_LABELS[plan.option as keyof typeof PAYMENT_OPTION_LABELS] ?? plan.option}
            </Badge>
          )}
        </div>
        <PaymentPlanDialog
          proposalId={proposalId}
          open={open}
          onOpenChange={setOpen}
          initial={initial}
          currency={currency}
          isNew={!plan}
          proposalGrossPremium={proposalGrossPremium}
          indicators={indicators}
          contratante={contratante}
        />
      </div>
      {plan ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 text-sm md:grid-cols-4">
          <Stat
            label="Cuotas"
            value={plan.installmentsCount > 0 ? String(plan.installmentsCount) : "—"}
          />
          <Stat
            label="Valor cuota"
            value={fmt(plan.valorCuota)}
          />
          <Stat
            label="Primer pago"
            value={
              plan.firstPaymentDate
                ? plan.firstPaymentDate.toLocaleDateString("es-CL")
                : "—"
            }
          />
          <Stat
            label="Prima bruta"
            value={fmt(plan.primaBruta)}
          />
          <Stat
            label="Cambio"
            value={fmt(plan.cambio)}
          />
          <Stat
            label="Prima total $"
            value={fmt(plan.primaTotalPesos)}
          />
          <Stat
            label="Pagador"
            value={[plan.payerName, plan.payerLastName].filter(Boolean).join(" ") || "—"}
          />
          <Stat label="RUT pagador" value={plan.payerRut ?? "—"} />
        </div>
      ) : (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Aún no se ha configurado el plan de pago.
        </div>
      )}
    </div>
  );
}

const EMPTY: PaymentPlanValues = {
  sinPlanDePago: false,
  option: undefined,
  installmentsCount: "0",
  observations: "",
  documented: false,
  firstPaymentDate: "",
  firstSignDate: "",
  valorCuota: "",
  cobrAnticipada: false,
  facturaAnticipada: false,
  requiereFactura: false,
  primaBruta: "",
  cambio: "",
  primaTotalPesos: "",
  payerRut: "",
  payerName: "",
  payerLastName: "",
  payerLegalName: "",
  payerPhone: "",
  payerCelular: "",
  payerEmail: "",
  generateInstallments: false,
};

function PaymentPlanDialog({
  proposalId,
  open,
  onOpenChange,
  initial,
  currency,
  isNew,
  proposalGrossPremium,
  indicators,
  contratante,
}: {
  proposalId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: PaymentPlanValues;
  currency: string;
  isNew: boolean;
  proposalGrossPremium: number;
  indicators: PaymentIndicators;
  contratante: PayerContratante | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rutQuery, setRutQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const autoRate = exchangeRateForCurrency(currency, indicators);

  // Al abrir, autocompleta tipo de cambio (según moneda + indicador SII) y
  // prima bruta (total de la propuesta) si vienen vacíos.
  useEffect(() => {
    if (!open) return;
    setValues((prev) => {
      const next = { ...prev };
      if ((!prev.cambio || prev.cambio === "") && autoRate != null) {
        next.cambio = String(autoRate);
      }
      if (
        (!prev.primaBruta || prev.primaBruta === "") &&
        proposalGrossPremium > 0
      ) {
        next.primaBruta = String(round2(proposalGrossPremium));
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Prima total en pesos = prima bruta × tipo de cambio (cálculo en vivo).
  const primaTotalCalc =
    Number(values.primaBruta || 0) * Number(values.cambio || 0);

  function copyFromContratante() {
    if (!contratante) return;
    setValues((v) => ({
      ...v,
      payerRut: contratante.rut ?? "",
      payerName: contratante.firstName ?? contratante.name ?? "",
      payerLastName: contratante.lastName ?? "",
      payerLegalName: contratante.legalName ?? "",
      payerPhone: contratante.phone ?? "",
      payerCelular: contratante.celular ?? "",
      payerEmail: contratante.email ?? "",
    }));
    toast.success("Datos del contratante copiados");
  }

  async function searchPayerByRut() {
    const q = rutQuery.trim() || values.payerRut.trim();
    if (!q) {
      toast.error("Ingresa un RUT para buscar.");
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/clients/payer-search?q=${encodeURIComponent(q)}`,
      );
      const json = (await res.json()) as {
        items: {
          rut?: string | null;
          name?: string | null;
          firstName?: string | null;
          lastNamePaterno?: string | null;
          legalName?: string | null;
          phone?: string | null;
          celular?: string | null;
          email?: string | null;
        }[];
      };
      const match = json.items?.[0];
      if (!match) {
        toast.error("No se encontró un cliente con ese RUT.");
        return;
      }
      setValues((v) => ({
        ...v,
        payerRut: match.rut ?? v.payerRut,
        payerName: match.firstName ?? match.name ?? v.payerName,
        payerLastName: match.lastNamePaterno ?? v.payerLastName,
        payerLegalName: match.legalName ?? v.payerLegalName,
        payerPhone: match.phone ?? v.payerPhone,
        payerCelular: match.celular ?? v.payerCelular,
        payerEmail: match.email ?? v.payerEmail,
      }));
      toast.success(`Cliente encontrado: ${match.name ?? match.rut}`);
    } catch {
      toast.error("Error al buscar el cliente.");
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = paymentPlanSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const r = await upsertPaymentPlanAction(proposalId, parsed.data);
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.success("Plan de pago guardado");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) setValues(initial);
        if (!v) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant={isNew ? "default" : "outline"}>
          <Pencil className="size-4" /> {isNew ? "Configurar" : "Editar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan de pago</DialogTitle>
          <DialogDescription>
            Define modalidad, cuotas y datos del pagador. Genera automáticamente
            las cuotas si lo solicitas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={values.sinPlanDePago}
              onCheckedChange={(v) =>
                setValues({ ...values, sinPlanDePago: v === true })
              }
            />
            Sin plan de pago
          </label>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <Label className="text-xs">Modalidad</Label>
              <Select
                value={values.option ?? ""}
                onValueChange={(v) =>
                  setValues({
                    ...values,
                    option: v === "" ? undefined : (v as PaymentPlanValues["option"]),
                  })
                }
                disabled={values.sinPlanDePago}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {PAYMENT_OPTION_LABELS[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">N° cuotas</Label>
              <Input
                type="number"
                value={values.installmentsCount}
                onChange={(e) =>
                  setValues({ ...values, installmentsCount: e.target.value })
                }
                disabled={values.sinPlanDePago}
              />
            </div>
            <div>
              <Label className="text-xs">Valor cuota ({currency})</Label>
              <Input
                type="number"
                step="0.01"
                value={values.valorCuota}
                onChange={(e) =>
                  setValues({ ...values, valorCuota: e.target.value })
                }
                disabled={values.sinPlanDePago}
              />
            </div>
            <div>
              <Label className="text-xs">Primer pago</Label>
              <Input
                type="date"
                value={values.firstPaymentDate}
                onChange={(e) =>
                  setValues({ ...values, firstPaymentDate: e.target.value })
                }
                disabled={values.sinPlanDePago}
              />
            </div>
            <div>
              <Label className="text-xs">Fecha firma PP</Label>
              <Input
                type="date"
                value={values.firstSignDate}
                onChange={(e) =>
                  setValues({ ...values, firstSignDate: e.target.value })
                }
                disabled={values.sinPlanDePago}
              />
            </div>
            <div>
              <Label className="text-xs">Prima bruta ({currency})</Label>
              <Input
                type="number"
                step="0.0001"
                value={values.primaBruta}
                onChange={(e) =>
                  setValues({ ...values, primaBruta: e.target.value })
                }
              />
            </div>
            <div>
              <div className="flex items-end justify-between">
                <Label className="text-xs">Cambio</Label>
                {autoRate != null && (
                  <button
                    type="button"
                    onClick={() =>
                      setValues({ ...values, cambio: String(autoRate) })
                    }
                    className="-mb-0.5 flex items-center gap-1 text-[11px] text-primary hover:underline"
                    title={`Tipo de cambio ${currency} de hoy`}
                  >
                    <RefreshCw className="size-3" /> Hoy:{" "}
                    {autoRate.toLocaleString("es-CL", {
                      maximumFractionDigits: 2,
                    })}
                  </button>
                )}
              </div>
              <Input
                type="number"
                step="0.0001"
                value={values.cambio}
                onChange={(e) =>
                  setValues({ ...values, cambio: e.target.value })
                }
              />
            </div>
            <div>
              <div className="flex items-end justify-between">
                <Label className="text-xs">Prima total $</Label>
                {primaTotalCalc > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setValues({
                        ...values,
                        primaTotalPesos: String(round2(primaTotalCalc)),
                      })
                    }
                    className="-mb-0.5 text-[11px] text-primary hover:underline"
                    title="Prima bruta × cambio"
                  >
                    = {primaTotalCalc.toLocaleString("es-CL", {
                      maximumFractionDigits: 0,
                    })}
                  </button>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                value={values.primaTotalPesos}
                onChange={(e) =>
                  setValues({ ...values, primaTotalPesos: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.documented}
                onCheckedChange={(v) =>
                  setValues({ ...values, documented: v === true })
                }
              />
              Documentado
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.cobrAnticipada}
                onCheckedChange={(v) =>
                  setValues({ ...values, cobrAnticipada: v === true })
                }
              />
              Cobranza anticipada
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.facturaAnticipada}
                onCheckedChange={(v) =>
                  setValues({ ...values, facturaAnticipada: v === true })
                }
              />
              Factura anticipada
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.requiereFactura}
                onCheckedChange={(v) =>
                  setValues({ ...values, requiereFactura: v === true })
                }
              />
              Requiere factura
            </label>
          </div>

          <div>
            <Label className="text-xs">Observaciones</Label>
            <Textarea
              rows={2}
              value={values.observations}
              onChange={(e) =>
                setValues({ ...values, observations: e.target.value })
              }
            />
          </div>

          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Datos del pagador
              </div>
              <div className="flex items-center gap-1.5">
                {contratante && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={copyFromContratante}
                  >
                    <UserCheck className="size-3.5" /> Copiar contratante
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">Buscar cliente por RUT</Label>
                <Input
                  value={rutQuery}
                  onChange={(e) => setRutQuery(e.target.value)}
                  placeholder="Ej: 12.345.678-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void searchPayerByRut();
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={searchPayerByRut}
                disabled={searching}
              >
                {searching ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Search className="size-3.5" />
                )}
                Buscar
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label className="text-xs">RUT</Label>
                <Input
                  value={values.payerRut}
                  onChange={(e) =>
                    setValues({ ...values, payerRut: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Nombre</Label>
                <Input
                  value={values.payerName}
                  onChange={(e) =>
                    setValues({ ...values, payerName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Apellido</Label>
                <Input
                  value={values.payerLastName}
                  onChange={(e) =>
                    setValues({ ...values, payerLastName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Razón social</Label>
                <Input
                  value={values.payerLegalName}
                  onChange={(e) =>
                    setValues({ ...values, payerLegalName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Teléfono</Label>
                <Input
                  value={values.payerPhone}
                  onChange={(e) =>
                    setValues({ ...values, payerPhone: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Celular</Label>
                <Input
                  value={values.payerCelular}
                  onChange={(e) =>
                    setValues({ ...values, payerCelular: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={values.payerEmail}
                  onChange={(e) =>
                    setValues({ ...values, payerEmail: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={values.generateInstallments}
              onCheckedChange={(v) =>
                setValues({ ...values, generateInstallments: v === true })
              }
            />
            Generar cuotas automáticamente (requiere N° cuotas, valor cuota y primer pago)
          </label>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="tabular-nums font-medium">{value}</div>
    </div>
  );
}

function fmt(v: number | null): string {
  if (v === null || v === 0) return "—";
  return v.toLocaleString("es-CL", { maximumFractionDigits: 2 });
}

function dateInput(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
