"use client";

import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { CURRENCIES } from "@/lib/money";
import { roleLabel } from "@/lib/roles";
import { policyFormSchema, type PolicyFormValues } from "../schemas";
import {
  createPolicyAction,
  updatePolicyAction,
  type ActionResult,
} from "../actions";
import type { CatalogItem } from "@/features/catalog/queries";
import type { OrgMember } from "@/features/clients/queries";
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

export function PolicyForm({
  mode,
  policyId,
  clients,
  companies,
  lines,
  members,
  branches,
  defaultValues,
}: {
  mode: "create" | "edit";
  policyId?: string;
  clients: CatalogItem[];
  companies: CatalogItem[];
  lines: CatalogItem[];
  members: OrgMember[];
  branches: { id: string; name: string; clientId: string }[];
  defaultValues: PolicyFormValues;
}) {
  const router = useRouter();
  const form = useForm<PolicyFormValues>({
    resolver: zodResolver(policyFormSchema),
    defaultValues,
  });
  const items = useFieldArray({ control: form.control, name: "items" });
  const coverages = useFieldArray({
    control: form.control,
    name: "coverages",
  });
  const selectedClientId = form.watch("clientId");
  const clientBranches = branches.filter(
    (b) => b.clientId === selectedClientId,
  );

  async function onSubmit(values: PolicyFormValues) {
    const result: ActionResult =
      mode === "create"
        ? await createPolicyAction(values)
        : await updatePolicyAction(policyId as string, values);

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof PolicyFormValues, { message });
        }
      }
      toast.error(result.error);
      return;
    }
    toast.success(mode === "create" ? "Póliza registrada" : "Cambios guardados");
    router.push(`/polizas/${result.id}`);
    router.refresh();
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-2xl space-y-8"
      >
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Identificación
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
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un cliente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="policyNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de póliza</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 12345678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Compañía</FormLabel>
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
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
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
              name="lineId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ramo</FormLabel>
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
                      {lines.map((line) => (
                        <SelectItem key={line.id} value={line.id}>
                          {line.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {clientBranches.length > 0 && (
              <FormField
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sucursal</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sin sucursal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientBranches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
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
                      {members.map((member) => (
                        <SelectItem key={member.userId} value={member.userId}>
                          {member.name} · {roleLabel(member.role)}
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

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Prima y vigencia
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="premiumNet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prima neta</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="0" {...field} />
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
                  <Select value={field.value} onValueChange={field.onChange}>
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
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inicio de vigencia</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Término de vigencia</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Materia asegurada
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                items.append({ description: "", insuredAmount: "" })
              }
            >
              <Plus />
              Agregar bien
            </Button>
          </div>
          {items.fields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sin bienes asegurados registrados.
            </p>
          )}
          {items.fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-3">
              <FormField
                control={form.control}
                name={`items.${index}.description`}
                render={({ field: f }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input placeholder="Bien o materia asegurada" {...f} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`items.${index}.insuredAmount`}
                render={({ field: f }) => (
                  <FormItem className="w-36">
                    <FormControl>
                      <Input inputMode="decimal" placeholder="Monto" {...f} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar bien"
                onClick={() => items.remove(index)}
              >
                <Trash2 className="text-muted-foreground" />
              </Button>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Coberturas
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                coverages.append({
                  name: "",
                  deductible: "",
                  insuredAmount: "",
                })
              }
            >
              <Plus />
              Agregar cobertura
            </Button>
          </div>
          {coverages.fields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sin coberturas registradas.
            </p>
          )}
          {coverages.fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-3">
              <FormField
                control={form.control}
                name={`coverages.${index}.name`}
                render={({ field: f }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input placeholder="Cobertura" {...f} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`coverages.${index}.deductible`}
                render={({ field: f }) => (
                  <FormItem className="w-32">
                    <FormControl>
                      <Input placeholder="Deducible" {...f} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`coverages.${index}.insuredAmount`}
                render={({ field: f }) => (
                  <FormItem className="w-32">
                    <FormControl>
                      <Input inputMode="decimal" placeholder="Monto" {...f} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar cobertura"
                onClick={() => coverages.remove(index)}
              >
                <Trash2 className="text-muted-foreground" />
              </Button>
            </div>
          ))}
        </section>

        <div className="flex items-center gap-3 border-t pt-5">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {mode === "create" ? "Registrar póliza" : "Guardar cambios"}
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
