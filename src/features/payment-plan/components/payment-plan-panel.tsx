"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Pencil } from "lucide-react";
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

export function PaymentPlanPanel({
  proposalId,
  plan,
  currency,
}: {
  proposalId: string;
  plan: Plan | null;
  currency: string;
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
}: {
  proposalId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: PaymentPlanValues;
  currency: string;
  isNew: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              <Label className="text-xs">Cambio</Label>
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
              <Label className="text-xs">Prima total $</Label>
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
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Datos del pagador
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
