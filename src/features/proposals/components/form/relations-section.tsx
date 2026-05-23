"use client";

import type { UseFormReturn } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
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
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { CoaseguroRows } from "./coaseguro-rows";
import { BrokerRows } from "./broker-rows";
import type { ProposalFormValues } from "../../schemas";

type CompanyOpt = { id: string; name: string };
type BrokerOpt = { id: string; name: string; rut: string | null };
type PolicyOpt = { id: string; policyNumber: string; clientId: string };

export function RelationsSection({
  form,
  companies,
  brokers,
  clientPolicies,
}: {
  form: UseFormReturn<ProposalFormValues>;
  companies: CompanyOpt[];
  brokers: BrokerOpt[];
  clientPolicies: PolicyOpt[];
}) {
  const isRenewal = form.watch("isRenewal");
  const coaseguro = form.watch("coaseguro");
  const coCorredor = form.watch("coCorredor");
  const garantia = form.watch("garantiaSuscripcion");
  const garantiaCompleted = form.watch("garantiaCompleted");

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4">
        <CheckField form={form} name="coaseguro" label="Coaseguro" />
        <CheckField form={form} name="coCorredor" label="Co-Corredor" />
        <CheckField form={form} name="reaseguro" label="Reaseguro" />
        <CheckField form={form} name="deOtroCorredor" label="De otro Corredor" />
        <CheckField form={form} name="garantiaSuscripcion" label="Garantía Suscripción" />
        <CheckField form={form} name="conReserva" label="Con Reserva" />
        <CheckField
          form={form}
          name="conClausulaInalterabilidad"
          label="Con Cláusula Inalterabilidad"
        />
        <CheckField form={form} name="facultativo" label="Facultativo" />
        <CheckField form={form} name="isRenewal" label="Es renovación" />
      </div>

      {isRenewal && (
        <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="previousPolicyNumberText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>N° póliza anterior (texto)</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: 1234-5678" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="previousPolicyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Póliza anterior (cliente)</FormLabel>
                <Select
                  value={field.value || undefined}
                  onValueChange={(v) => {
                    const newId = v === "__NONE" ? "" : v;
                    field.onChange(newId);
                    const pol = clientPolicies.find((p) => p.id === newId);
                    if (pol && !form.getValues("previousPolicyNumberText")) {
                      form.setValue(
                        "previousPolicyNumberText",
                        pol.policyNumber,
                      );
                    }
                  }}
                  disabled={clientPolicies.length === 0}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          clientPolicies.length === 0
                            ? "Sin pólizas del cliente"
                            : "Selecciona póliza"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__NONE">Ninguna</SelectItem>
                    {clientPolicies.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.policyNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      {coaseguro && (
        <div className="sm:col-span-2">
          <CoaseguroRows form={form} companies={companies} />
        </div>
      )}

      {coCorredor && (
        <div className="sm:col-span-2">
          <BrokerRows form={form} brokers={brokers} />
        </div>
      )}

      {garantia && (
        <div className="sm:col-span-2 space-y-3 rounded-md border bg-muted/30 p-3">
          <FormField
            control={form.control}
            name="garantiaObservations"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observaciones de garantía</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    minHeightClass="min-h-[120px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="garantiaExpiry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vence el</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <CheckField
              form={form}
              name="garantiaCompleted"
              label="Cumplida"
            />
            {garantiaCompleted && (
              <FormField
                control={form.control}
                name="garantiaCompletedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha cumplimiento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CheckField({
  form,
  name,
  label,
}: {
  form: UseFormReturn<ProposalFormValues>;
  name: keyof ProposalFormValues;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={Boolean(form.watch(name))}
        onCheckedChange={(v) => form.setValue(name, v === true)}
      />
      {label}
    </label>
  );
}
