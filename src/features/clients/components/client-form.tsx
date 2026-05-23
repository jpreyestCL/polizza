"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, Loader2, Search, TriangleAlert } from "lucide-react";
import { REGIONS } from "@/lib/regions-communes";
import { formatRut, isValidRut } from "@/lib/rut";
import { roleLabel } from "@/lib/roles";
import {
  clientFormSchema,
  type ClientFormValues,
  CLIENT_STATUSES,
} from "../schemas";
import {
  checkClientEmailAction,
  createClientAction,
  updateClientAction,
  type ActionResult,
} from "../actions";
import type { OrgMember } from "../queries";
import { ClientContactsField } from "./client-contacts-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const STATUS_LABELS: Record<string, string> = {
  PROSPECTO: "Prospecto",
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

type EmailCheck =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "free" }
  | { state: "taken"; name: string | null };

export function ClientForm({
  mode,
  clientId,
  members,
  holdings,
  defaultValues,
}: {
  mode: "create" | "edit";
  clientId?: string;
  members: OrgMember[];
  holdings: { id: string; name: string }[];
  defaultValues: ClientFormValues;
}) {
  const router = useRouter();
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues,
  });
  const [emailCheck, setEmailCheck] = useState<EmailCheck>({ state: "idle" });

  const type = form.watch("type");
  const status = form.watch("status");
  const region = form.watch("region");
  const communes = REGIONS.find((r) => r.name === region)?.communes ?? [];

  async function verifyEmail() {
    const email = form.getValues("email").trim();
    if (!email) {
      setEmailCheck({ state: "idle" });
      return;
    }
    setEmailCheck({ state: "loading" });
    const result = await checkClientEmailAction(email, clientId);
    setEmailCheck(
      result.exists
        ? { state: "taken", name: result.clientName }
        : { state: "free" },
    );
  }

  async function onSubmit(values: ClientFormValues) {
    const result: ActionResult =
      mode === "create"
        ? await createClientAction(values)
        : await updateClientAction(clientId as string, values);

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof ClientFormValues, { message });
        }
      }
      toast.error(result.error);
      return;
    }
    toast.success(mode === "create" ? "Cliente creado" : "Cambios guardados");
    router.push(`/clientes/${result.id}`);
    router.refresh();
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-3xl space-y-8"
      >
        <section className="space-y-4">
          <SectionTitle>Tipo y estado</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de cliente</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PERSONA">Persona</SelectItem>
                      <SelectItem value="EMPRESA">Empresa</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
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
                      {CLIENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {status === "ACTIVO" ? (
            <p className="text-xs text-muted-foreground">
              Un cliente Activo exige dirección, comuna, región y al menos un
              teléfono o celular.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Como Prospecto solo se exigen nombre y RUT; el resto es opcional.
            </p>
          )}
        </section>

        <section className="space-y-4">
          <SectionTitle>Identificación</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="rut"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RUT</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="12.345.678-9"
                      {...field}
                      onBlur={() => {
                        field.onBlur();
                        if (isValidRut(field.value)) {
                          form.setValue("rut", formatRut(field.value));
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {type === "EMPRESA" ? (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombres</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {type === "PERSONA" && (
              <>
                <FormField
                  control={form.control}
                  name="lastNamePaterno"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido paterno</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastNameMaterno"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido materno</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            {type === "EMPRESA" && (
              <>
                <FormField
                  control={form.control}
                  name="legalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razón social</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="giro"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Giro</FormLabel>
                      <FormControl>
                        <Input placeholder="Giro comercial" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            {type === "PERSONA" && (
              <FormField
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de nacimiento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle>Contacto y ubicación</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Correo</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        type="email"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          setEmailCheck({ state: "idle" });
                        }}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={verifyEmail}
                      disabled={emailCheck.state === "loading"}
                    >
                      {emailCheck.state === "loading" ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Search />
                      )}
                      Verificar
                    </Button>
                  </div>
                  {emailCheck.state === "free" && (
                    <p className="flex items-center gap-1.5 text-xs text-success">
                      <Check className="size-3.5" />
                      No hay otro cliente con ese correo.
                    </p>
                  )}
                  {emailCheck.state === "taken" && (
                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                      <TriangleAlert className="size-3.5" />
                      Ya existe un cliente con ese correo
                      {emailCheck.name ? `: ${emailCheck.name}` : ""}.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="celular"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Celular</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Región</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("commune", "");
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar región" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REGIONS.map((r) => (
                        <SelectItem key={r.code} value={r.name}>
                          {r.name}
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
              name="commune"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comuna</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    disabled={communes.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            communes.length === 0
                              ? "Elige una región primero"
                              : "Seleccionar comuna"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {communes.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
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
          <SectionTitle>Gestión</SectionTitle>
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
            <FormField
              control={form.control}
              name="vendedor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendedor</FormLabel>
                  <FormControl>
                    <Input placeholder="Opcional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cobranzaUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ejecutivo de cobranza</FormLabel>
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
                          {m.name}
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
              name="siniestrosUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ejecutivo de siniestros</FormLabel>
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
                          {m.name}
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
              name="holdingId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Holding</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    disabled={holdings.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            holdings.length === 0
                              ? "Sin holdings creados"
                              : "Sin holding"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {holdings.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name}
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
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Origen</FormLabel>
                  <FormControl>
                    <Input placeholder="Referido, web, campaña…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle>Comentarios</SectionTitle>
          <FormField
            control={form.control}
            name="comentarioAlerta"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Comentario de alerta</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Si tiene contenido, se mostrará como banner de alerta en las
                  propuestas y la ficha del cliente.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="observaciones"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observaciones</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section className="space-y-4">
          <SectionTitle>Contactos</SectionTitle>
          <ClientContactsField clientType={type} />
        </section>

        <div className="flex items-center gap-3 border-t pt-5">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {mode === "create" ? "Crear cliente" : "Guardar cambios"}
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
