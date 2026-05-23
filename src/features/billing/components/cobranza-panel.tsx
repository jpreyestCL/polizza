"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, Loader2, Plus, RotateCcw, Trash2, Wallet } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { CURRENCIES, formatMoney, type CurrencyCode } from "@/lib/money";
import { generatePlanSchema, type GeneratePlanValues } from "../schemas";
import {
  deleteInstallmentAction,
  generateInstallmentPlanAction,
  markInstallmentPaidAction,
  markInstallmentPendingAction,
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
}: {
  policyId: string;
  installments: InstallmentItem[];
  defaultCurrency: CurrencyCode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
  const paid = installments
    .filter((i) => i.status === "PAGADA")
    .reduce((sum, i) => sum + i.amount, 0);
  const pending = installments
    .filter((i) => i.status === "PENDIENTE")
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-4">
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
                {installment.status === "PAGADA" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Marcar pendiente"
                    disabled={busyId === installment.id}
                    onClick={() =>
                      runAction(
                        installment.id,
                        markInstallmentPendingAction,
                        "Cuota reabierta",
                      )
                    }
                  >
                    <RotateCcw className="text-muted-foreground" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Marcar pagada"
                    disabled={busyId === installment.id}
                    onClick={() =>
                      runAction(
                        installment.id,
                        markInstallmentPaidAction,
                        "Cuota marcada como pagada",
                      )
                    }
                  >
                    {busyId === installment.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Check className="text-primary" />
                    )}
                  </Button>
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
