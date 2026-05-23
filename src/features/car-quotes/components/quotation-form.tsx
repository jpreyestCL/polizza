"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Car, Loader2, Search } from "lucide-react";
import { roleLabel } from "@/lib/roles";
import type { CatalogItem } from "@/features/catalog/queries";
import type { OrgMember } from "@/features/clients/queries";
import {
  carQuotationFormSchema,
  CIVIL_LIABILITIES,
  CIVIL_LIABILITY_LABELS,
  DEDUCTIBLE_OPTIONS,
  VEHICLE_CONDITION_LABELS,
  VEHICLE_CONDITIONS,
  VEHICLE_USE_LABELS,
  VEHICLE_USES,
  WORKSHOP_TYPE_LABELS,
  WORKSHOP_TYPES,
  type CarQuotationFormValues,
} from "../schemas";
import {
  createCarQuotationAction,
  lookupVehicleAction,
  type ActionResult,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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

export type InsurerOption = { key: string; name: string };

export function QuotationForm({
  clients,
  insurers,
  members,
  defaultValues,
}: {
  clients: CatalogItem[];
  insurers: InsurerOption[];
  members: OrgMember[];
  defaultValues: CarQuotationFormValues;
}) {
  const router = useRouter();
  const [lookingUp, startLookup] = useTransition();
  const [lookupNote, setLookupNote] = useState<string | null>(null);

  const form = useForm<CarQuotationFormValues>({
    resolver: zodResolver(carQuotationFormSchema),
    defaultValues,
  });

  async function onSubmit(values: CarQuotationFormValues) {
    const result: ActionResult = await createCarQuotationAction(values);
    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof CarQuotationFormValues, { message });
        }
      }
      toast.error(result.error);
      return;
    }
    toast.success("Cotización creada, procesando aseguradoras…");
    router.push(`/cotizaciones/${result.id}`);
    router.refresh();
  }

  function handleLookup() {
    const patente = form.getValues("patente");
    if (!patente || patente.length < 4) {
      form.setError("patente", { message: "Ingresa una patente válida" });
      return;
    }
    setLookupNote(null);
    startLookup(async () => {
      const res = await lookupVehicleAction(patente);
      if (!res.ok) {
        setLookupNote(res.error);
        toast.error(res.error);
        return;
      }
      const { data, source } = res;
      if (data.marca) form.setValue("marca", data.marca);
      if (data.modelo) form.setValue("modelo", data.modelo);
      if (data.anio) form.setValue("anio", String(data.anio));
      if (data.tipoVehiculo) form.setValue("tipoVehiculo", data.tipoVehiculo);
      if (data.motorizacion) form.setValue("motorizacion", data.motorizacion);
      setLookupNote(`Datos obtenidos de ${source}.`);
      toast.success(`Vehículo encontrado en ${source}`);
    });
  }

  const isSubmitting = form.formState.isSubmitting;
  const deductibles = form.watch("deductibles");
  const insurerKeys = form.watch("insurerKeys");

  function toggleDeductible(value: number) {
    const current = form.getValues("deductibles") ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value].sort((a, b) => a - b);
    form.setValue("deductibles", next, { shouldDirty: true });
  }

  function toggleInsurer(key: string) {
    const current = form.getValues("insurerKeys") ?? [];
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    form.setValue("insurerKeys", next, { shouldValidate: true, shouldDirty: true });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl space-y-7">
        {/* Cliente */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Cliente
          </h2>
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={defaultValues.clientId !== ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un cliente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        {/* Vehículo */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Vehículo
          </h2>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex flex-col items-end gap-3 sm:flex-row">
              <FormField
                control={form.control}
                name="patente"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Patente</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="AB1234 / BBBC12"
                        autoCapitalize="characters"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleLookup}
                disabled={lookingUp}
              >
                {lookingUp ? <Loader2 className="animate-spin" /> : <Search />}
                Consultar vehículo
              </Button>
            </div>
            {lookupNote && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Car className="size-3.5" />
                {lookupNote}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="marca"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marca</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Toyota" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="modelo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Yaris" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="anio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Año</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" placeholder="2022" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tipoVehiculo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo vehículo</FormLabel>
                  <FormControl>
                    <Input placeholder="Sedán, SUV…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="motorizacion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motorización</FormLabel>
                  <FormControl>
                    <Input placeholder="1.5L bencina" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vehicleCondition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VEHICLE_CONDITIONS.map((v) => (
                        <SelectItem key={v} value={v}>
                          {VEHICLE_CONDITION_LABELS[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vehicleUse"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Uso</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VEHICLE_USES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {VEHICLE_USE_LABELS[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* Coberturas */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Coberturas
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="civilLiability"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsabilidad civil</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CIVIL_LIABILITIES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {CIVIL_LIABILITY_LABELS[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="workshopType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Taller</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WORKSHOP_TYPES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {WORKSHOP_TYPE_LABELS[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div>
            <Label className="text-sm">Deducibles a cotizar (UF)</Label>
            <p className="text-xs text-muted-foreground">
              Marca uno o más; si dejas todo en blanco, se cotizan todos.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {DEDUCTIBLE_OPTIONS.map((d) => {
                const checked = deductibles?.includes(d) ?? false;
                return (
                  <label
                    key={d}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleDeductible(d)}
                    />
                    UF {d}
                  </label>
                );
              })}
            </div>
          </div>
        </section>

        {/* Aseguradoras */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Aseguradoras a cotizar
          </h2>
          <FormField
            control={form.control}
            name="insurerKeys"
            render={() => (
              <FormItem>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {insurers.map((ins) => {
                    const checked = insurerKeys?.includes(ins.key) ?? false;
                    return (
                      <label
                        key={ins.key}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleInsurer(ins.key)}
                        />
                        {ins.name}
                      </label>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        {/* Asignación y notas */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Otros
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="assignedUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ejecutivo asignado</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.name} · {roleLabel(m.role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notas internas</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="Comentarios, observaciones, contexto…"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <div className="flex items-center gap-3 border-t pt-5">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Crear cotización
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}
