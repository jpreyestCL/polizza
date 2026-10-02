"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { CURRENCIES, formatMoney, type CurrencyCode } from "@/lib/money";
import {
  generatePlanSchema,
  INSTALLMENT_STATUS_LABELS,
  INSTALLMENT_STATUSES,
  type GeneratePlanValues,
  type InstallmentStatusValue,
} from "../schemas";
import {
  deleteInstallmentAction,
  generateInstallmentPlanAction,
  setInstallmentStatusAction,
  type ActionResult,
} from "../actions";
import type { InstallmentItem } from "../queries";
import { InstallmentBadge } from "./installment-badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CobranzaPanel({
  policyId,
  installments,
  defaultCurrency,
  termination,
}: {
  policyId: string;
  installments: InstallmentItem[];
  defaultCurrency: CurrencyCode;
  termination?: {
    balance: number;
    isEstimate: boolean;
    reason: string | null;
  } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [partialTarget, setPartialTarget] = useState<InstallmentItem | null>(
    null,
  );
  const [partialAmount, setPartialAmount] = useState("");
  const [partialMode, setPartialMode] = useState<"PARCIAL" | "PAGADA">("PARCIAL");
  const [companyOn, setCompanyOn] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const form = useForm<GeneratePlanValues>({
    resolver: zodResolver(generatePlanSchema),
    defaultValues: {
      count: "1",
      amount: "",
      firstDueDate: "",
      currency: defaultCurrency,
    },
  });

  async function onGenerate(values: GeneratePlanValues) {
    const result = await generateInstallmentPlanAction(policyId, values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Plan de cuotas generado");
    setOpen(false);
    form.reset({
      count: "1",
      amount: "",
      firstDueDate: "",
      currency: defaultCurrency,
    });
    router.refresh();
  }

  async function runAction(
    id: string,
    fn: (id: string) => Promise<ActionResult>,
    successMessage: string,
  ) {
    setBusyId(id);
    const result = await fn(id);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(successMessage);
    router.refresh();
  }

  const currency = installments[0]?.currency ?? defaultCurrency;
  let paid = 0;
  let pending = 0;
  for (const installment of installments) {
    if (
      installment.status === "PAGADA" ||
      installment.status === "PRESUNTA"
    ) {
      paid += installment.amount;
    } else if (installment.status === "PARCIAL") {
      const collected = installment.amountPaid ?? 0;
      paid += collected;
      pending += Math.max(0, installment.amount - collected);
    } else if (
      installment.status === "PENDIENTE" ||
      installment.status === "RECHAZADA"
    ) {
      pending += installment.amount;
    }
  }

  const closedLabel =
    termination?.reason === "ANNULMENT"
      ? "Anulación"
      : termination?.reason === "CANCELLATION"
        ? "Cancelación"
        : "Término";

  return (
    <div className="space-y-4">
      {termination && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Saldo de {closedLabel.toLowerCase()}:{" "}
          <span className="font-medium">
            {formatMoney(termination.balance, defaultCurrency)}
          </span>
          {termination.isEstimate
            ? ". Estimado hasta que la compañía confirme el monto. Positivo: el cliente debe. Negativo: devolución."
            : "."}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {installments.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Pagado{" "}
            <span className="font-medium text-foreground">
              {formatMoney(paid, currency as CurrencyCode)}
            </span>{" "}
            · Pendiente{" "}
            <span className="font-medium text-foreground">
              {formatMoney(pending, currency as CurrencyCode)}
            </span>
          </p>
        )}
        <Button
          type="button"
          className="sm:ml-auto"
          onClick={() => {
            form.reset({
              count: "1",
              amount: "",
              firstDueDate: "",
              currency: defaultCurrency,
            });
            setOpen(true);
          }}
        >
          <Plus />
          Generar cuotas
        </Button>
      </div>

      {installments.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Sin plan de pago"
          description="Genera un plan de cuotas para llevar el control de cobranza de esta póliza."
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {installments.map((installment) => (
            <li
              key={installment.id}
              className="flex items-center justify-between gap-3 p-3.5"
            >
              <div className="min-w-0">
                <p className="font-medium">Cuota {installment.number}</p>
                <p className="text-xs text-muted-foreground">
                  Vence el {formatDate(installment.dueDate)}
                  {installment.paidAt &&
                    ` · pagada el ${formatDate(installment.paidAt)}`}
                  {installment.status === "PARCIAL" &&
                    installment.amountPaid != null &&
                    ` · cobrado ${formatMoney(installment.amountPaid, installment.currency as CurrencyCode)}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {formatMoney(
                    installment.amount,
                    installment.currency as CurrencyCode,
                  )}
                </span>
                <InstallmentBadge
                  status={installment.status}
                  overdue={installment.overdue}
                />
                {installment.voidedByTermination ||
                installment.status === "ANULADA" ? null : (
                  <Select
                    value={installment.status}
                    onValueChange={(value) => {
                      if (value === "PARCIAL" || value === "PAGADA") {
                        setPartialMode(value);
                        setPartialTarget(installment);
                        setPartialAmount(
                          value === "PAGADA"
                            ? String(installment.amount)
                            : installment.amountPaid != null
                              ? String(installment.amountPaid)
                              : "",
                        );
                        setCompanyOn("");
                        return;
                      }
                      runAction(
                        installment.id,
                        (id) =>
                          setInstallmentStatusAction(
                            id,
                            value as InstallmentStatusValue,
                          ),
                        `Cuota ${INSTALLMENT_STATUS_LABELS[value as InstallmentStatusValue].toLowerCase()}`,
                      );
                    }}
                  >
                    <SelectTrigger className="h-8 w-[9.5rem]" aria-label="Estado de la cuota">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTALLMENT_STATUSES.filter(
                        (status) => status !== "ANULADA" && status !== "CREDITED",
                      ).map(
                        (status) => (
                          <SelectItem key={status} value={status}>
                            {INSTALLMENT_STATUS_LABELS[status]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Eliminar cuota"
                  disabled={busyId === installment.id}
                  onClick={() =>
                    runAction(
                      installment.id,
                      deleteInstallmentAction,
                      "Cuota eliminada",
                    )
                  }
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={partialTarget != null}
        onOpenChange={(next) => {
          if (!next) setPartialTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {partialMode === "PAGADA" ? "Registrar pago" : "Cuota parcial"}
            </DialogTitle>
            <DialogDescription>
              {partialMode === "PAGADA"
                ? "La fecha de la compañía puede quedar vacía si todavía no aparece en su cartola."
                : "Indica cuánto se cobró. Al cancelar o anular la póliza, esa parte cuenta como pagada y el resto de la cuota se anula."}
            </DialogDescription>
          </DialogHeader>
          {partialMode === "PARCIAL" ? (
            <div>
              <label className="text-xs" htmlFor="partial-amount">
                Monto cobrado
              </label>
              <Input
                id="partial-amount"
                inputMode="decimal"
                value={partialAmount}
                onChange={(event) => setPartialAmount(event.target.value)}
              />
            </div>
          ) : null}
          <div>
            <label className="text-xs" htmlFor="company-on">
              Fecha registrada por la compañía
            </label>
            <Input
              id="company-on"
              type="date"
              value={companyOn}
              onChange={(event) => setCompanyOn(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={async () => {
                if (!partialTarget) return;
                const amount = Number(partialAmount.replace(",", "."));
                const id = partialTarget.id;
                setBusyId(id);
                const result = await setInstallmentStatusAction(
                  id,
                  partialMode,
                  partialMode === "PAGADA" ? Number(partialTarget.amount) : amount,
                  companyOn || null,
                );
                setBusyId(null);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Cuota parcial");
                setPartialTarget(null);
                router.refresh();
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generar plan de cuotas</DialogTitle>
            <DialogDescription>
              Se crearán cuotas mensuales consecutivas a partir de la fecha
              indicada.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              id="plan-form"
              onSubmit={form.handleSubmit(onGenerate)}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="count"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>N° de cuotas</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          placeholder="12"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto por cuota</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="decimal"
                          placeholder="0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="firstDueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primera cuota</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moneda</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CURRENCIES.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="plan-form"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="animate-spin" />
              )}
              Generar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
