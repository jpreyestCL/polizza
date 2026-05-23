"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Save } from "lucide-react";
import { QuickClientDialog } from "@/features/clients/components/quick-client-dialog";
import { FullClientDialog } from "@/features/clients/components/full-client-dialog";
import { ClientCombobox } from "@/components/ui/client-combobox";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { CURRENCIES, currencyLabel } from "@/lib/money";
import { roleLabel } from "@/lib/roles";
import { proposalFormSchema, type ProposalFormValues } from "../schemas";
import {
  createProposalAction,
  updateProposalAction,
  saveProposalDraft,
  assignProposalNumber,
  type ActionResult,
} from "../actions";
import type { ProposalFormCatalog } from "../queries";
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
import { RelationsSection } from "./form/relations-section";

type ClientOpt = { id: string; name: string; rut?: string | null };
type BrokerOpt = { id: string; name: string; rut: string | null };

export function ProposalForm({
  mode,
  proposalId,
  initialProposalNumber = null,
  clients,
  members,
  brokers,
  catalog,
  defaultValues,
}: {
  mode: "create" | "edit";
  proposalId?: string;
  initialProposalNumber?: string | null;
  clients: ClientOpt[];
  members: OrgMember[];
  brokers: BrokerOpt[];
  catalog: ProposalFormCatalog;
  defaultValues: ProposalFormValues;
}) {
  const router = useRouter();
  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues,
  });
  const [localClients, setLocalClients] = useState<ClientOpt[]>(clients);
  const [createDialog, setCreateDialog] = useState<{
    field: "clientId" | "insuredClientId" | "beneficiaryClientId";
    mode: "full" | "quick";
    defaultRut: string;
    defaultName: string;
  } | null>(null);
  const [currentMode, setCurrentMode] = useState(mode);
  const [currentId, setCurrentId] = useState<string | undefined>(proposalId);
  const [proposalNumber, setProposalNumber] = useState<string | null>(
    initialProposalNumber,
  );
  const lastContratanteRef = useRef<string>(defaultValues.clientId);
  const lastSavedSigRef = useRef<string>("");

  function handleClientCreated(
    field: "clientId" | "insuredClientId" | "beneficiaryClientId",
    id: string,
    name: string,
    rut?: string | null,
  ) {
    setLocalClients((prev) =>
      prev.some((c) => c.id === id)
        ? prev
        : [...prev, { id, name, rut: rut ?? null }],
    );
    form.setValue(field, id, { shouldDirty: true });
  }

  function openCreateDialog(
    field: "clientId" | "insuredClientId" | "beneficiaryClientId",
    query: string,
  ) {
    const trimmed = query.trim();
    const looksLikeRut = /[0-9]/.test(trimmed) && trimmed.length <= 12;
    setCreateDialog({
      field,
      mode: field === "clientId" ? "full" : "quick",
      defaultRut: looksLikeRut ? trimmed : "",
      defaultName: looksLikeRut ? "" : trimmed,
    });
  }

  const selectedCompanyId = form.watch("insuranceCompanyId");
  const selectedBranchTypeId = form.watch("branchTypeId");
  const selectedProductId = form.watch("productId");
  const selectedClientId = form.watch("clientId");

  const filteredProducts = useMemo(
    () =>
      catalog.products.filter(
        (p) =>
          (!selectedCompanyId || p.insuranceCompanyId === selectedCompanyId) &&
          (!selectedBranchTypeId || p.branchTypeId === selectedBranchTypeId),
      ),
    [catalog.products, selectedCompanyId, selectedBranchTypeId],
  );

  const clientQuotations = useMemo(
    () =>
      catalog.quotations.filter(
        (q) => !selectedClientId || q.clientId === selectedClientId,
      ),
    [catalog.quotations, selectedClientId],
  );

  const clientPolicies = useMemo(
    () =>
      catalog.policies.filter(
        (p) => !selectedClientId || p.clientId === selectedClientId,
      ),
    [catalog.policies, selectedClientId],
  );

  const selectedCompany = catalog.companies.find(
    (c) => c.id === selectedCompanyId,
  );
  const selectedProduct = catalog.products.find(
    (p) => p.id === selectedProductId,
  );

  // Contratante por defecto en asegurado/beneficiario
  useEffect(() => {
    const prev = lastContratanteRef.current;
    const current = selectedClientId;
    if (!current || current === prev) return;
    const ins = form.getValues("insuredClientId");
    const ben = form.getValues("beneficiaryClientId");
    if (!ins || ins === prev) {
      form.setValue("insuredClientId", current, { shouldDirty: true });
    }
    if (!ben || ben === prev) {
      form.setValue("beneficiaryClientId", current, { shouldDirty: true });
    }
    lastContratanteRef.current = current;
  }, [selectedClientId, form]);

  function applyProductCommission(productId: string) {
    const product = catalog.products.find((p) => p.id === productId);
    if (!product) return;
    const cur = form.getValues();
    if (!cur.commissionAffectPct && product.commissionAffectPct !== null) {
      form.setValue("commissionAffectPct", String(product.commissionAffectPct));
    }
    if (!cur.commissionExemptPct && product.commissionExemptPct !== null) {
      form.setValue("commissionExemptPct", String(product.commissionExemptPct));
    }
    if (product.branchTypeId && !cur.branchTypeId) {
      form.setValue("branchTypeId", product.branchTypeId);
    }
  }

  function applyCompanyDefaultEmail(companyId: string) {
    const company = catalog.companies.find((c) => c.id === companyId);
    if (!company) return;
    const defaultContact = company.contacts.find((c) => c.isDefault);
    const email = defaultContact?.email ?? company.defaultEmail ?? "";
    if (email) {
      form.setValue("recipientEmail", email, { shouldDirty: true });
      if (defaultContact) {
        form.setValue("recipientContactId", defaultContact.id, {
          shouldDirty: true,
        });
      }
    }
  }

  function addOneYear() {
    const start = form.getValues("startDate");
    if (!start) {
      toast.error("Define primero la fecha de inicio");
      return;
    }
    const d = new Date(start);
    if (Number.isNaN(d.getTime())) return;
    d.setFullYear(d.getFullYear() + 1);
    const iso = d.toISOString().slice(0, 10);
    form.setValue("endDate", iso, { shouldDirty: true });
  }

  // Autosave de borrador (1.5s debounce). Solo cuando hay datos mínimos
  // y aún no se ha "promovido" al guardado completo.
  const watched = useWatch({ control: form.control });
  useEffect(() => {
    const sig = JSON.stringify({
      c: watched.clientId,
      co: watched.insuranceCompanyId,
      b: watched.branchTypeId,
      l: watched.lineId,
      br: watched.branchId,
      pid: currentId,
    });
    if (!watched.clientId || !watched.insuranceCompanyId) return;
    if (!watched.branchTypeId && !(watched.lineId && watched.branchId)) return;
    if (sig === lastSavedSigRef.current) return;
    const t = setTimeout(async () => {
      const result = await saveProposalDraft({
        proposalId: currentId,
        clientId: watched.clientId!,
        insuranceCompanyId: watched.insuranceCompanyId!,
        branchTypeId: watched.branchTypeId ?? "",
        lineId: watched.lineId ?? "",
        branchId: watched.branchId ?? "",
      });
      if (!result.ok) return;
      lastSavedSigRef.current = sig;
      const draftId = result.id;
      const wasCreating = currentMode === "create";
      if (wasCreating) {
        setCurrentId(draftId);
        setCurrentMode("edit");
        window.history.replaceState(null, "", `/propuestas/${draftId}/editar`);
      }
      await maybeAssignNumber(draftId);
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    watched.clientId,
    watched.insuranceCompanyId,
    watched.branchTypeId,
    watched.lineId,
    watched.branchId,
    watched.insuredClientId,
    watched.beneficiaryClientId,
    watched.productId,
  ]);

  async function maybeAssignNumber(id: string) {
    if (proposalNumber) return;
    const v = form.getValues();
    if (
      !v.clientId ||
      !v.insuredClientId ||
      !v.beneficiaryClientId ||
      !v.insuranceCompanyId ||
      !v.branchTypeId ||
      !v.productId
    ) {
      return;
    }
    const r = await assignProposalNumber(id);
    if (r.ok && r.proposalNumber) {
      setProposalNumber(r.proposalNumber);
      toast.success(`Propuesta N° ${r.proposalNumber} creada`);
    }
  }

  async function onSaveDraft() {
    const v = form.getValues();
    const r = await saveProposalDraft({
      proposalId: currentId,
      clientId: v.clientId,
      insuranceCompanyId: v.insuranceCompanyId,
      branchTypeId: v.branchTypeId,
      lineId: v.lineId,
      branchId: v.branchId,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Borrador guardado");
    if (!currentId) {
      setCurrentId(r.id);
      setCurrentMode("edit");
      window.history.replaceState(null, "", `/propuestas/${r.id}/editar`);
    }
    await maybeAssignNumber(r.id);
  }

  async function onSubmit(values: ProposalFormValues) {
    const result: ActionResult =
      currentMode === "create"
        ? await createProposalAction(values)
        : await updateProposalAction(currentId as string, values);

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof ProposalFormValues, { message });
        }
      }
      toast.error(result.error);
      return;
    }
    toast.success(currentMode === "create" ? "Propuesta creada" : "Cambios guardados");
    router.push(`/propuestas/${result.id}`);
    router.refresh();
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      {proposalNumber && (
        <div className="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          Propuesta: <span className="font-semibold">{proposalNumber}</span>
        </div>
      )}
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-4xl space-y-8"
      >
        <Section title="Contratante, asegurado y beneficiario">
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Contratante (RUT/cliente) *</FormLabel>
                <ClientCombobox
                  value={field.value}
                  onChange={(id, c) => {
                    field.onChange(id);
                    if (c && !localClients.some((x) => x.id === c.id)) {
                      setLocalClients((p) => [
                        ...p,
                        { id: c.id, name: c.name, rut: c.rut ?? null },
                      ]);
                    }
                  }}
                  initial={
                    localClients.find((c) => c.id === field.value) ?? null
                  }
                  onCreate={(q) => openCreateDialog("clientId", q)}
                  createLabel="Agregar nuevo (ficha completa)"
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="insuredClientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Asegurado (default para ítems)</FormLabel>
                <ClientCombobox
                  value={field.value}
                  onChange={(id, c) => {
                    field.onChange(id);
                    if (c && !localClients.some((x) => x.id === c.id)) {
                      setLocalClients((p) => [
                        ...p,
                        { id: c.id, name: c.name, rut: c.rut ?? null },
                      ]);
                    }
                  }}
                  initial={localClients.find((c) => c.id === field.value) ?? null}
                  onCreate={(q) => openCreateDialog("insuredClientId", q)}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="beneficiaryClientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Beneficiario (default para ítems)</FormLabel>
                <ClientCombobox
                  value={field.value}
                  onChange={(id, c) => {
                    field.onChange(id);
                    if (c && !localClients.some((x) => x.id === c.id)) {
                      setLocalClients((p) => [
                        ...p,
                        { id: c.id, name: c.name, rut: c.rut ?? null },
                      ]);
                    }
                  }}
                  initial={localClients.find((c) => c.id === field.value) ?? null}
                  onCreate={(q) => openCreateDialog("beneficiaryClientId", q)}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        {createDialog?.mode === "full" && (
          <FullClientDialog
            open
            onOpenChange={(v) => {
              if (!v) setCreateDialog(null);
            }}
            defaultRut={createDialog.defaultRut}
            defaultName={createDialog.defaultName}
            onCreated={(id, name, rut) => {
              handleClientCreated(createDialog.field, id, name, rut);
              setCreateDialog(null);
            }}
          />
        )}
        {createDialog?.mode === "quick" && (
          <QuickClientDialog
            open
            onOpenChange={(v) => {
              if (!v) setCreateDialog(null);
            }}
            trigger={null}
            defaultRut={createDialog.defaultRut}
            defaultName={createDialog.defaultName}
            onCreated={(id, name) => {
              handleClientCreated(createDialog.field, id, name);
              setCreateDialog(null);
            }}
          />
        )}

        <Section title="Compañía, ramo y producto">
          <FormField
            control={form.control}
            name="insuranceCompanyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Compañía aseguradora</FormLabel>
                <Select
                  value={field.value || undefined}
                  onValueChange={(v) => {
                    field.onChange(v);
                    applyCompanyDefaultEmail(v);
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona compañía" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {catalog.companies.map((c) => (
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
          <FormField
            control={form.control}
            name="branchTypeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ramo</FormLabel>
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona ramo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {catalog.branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
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
            name="productId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Producto</FormLabel>
                <Select
                  value={field.value || undefined}
                  onValueChange={(v) => {
                    field.onChange(v);
                    applyProductCommission(v);
                  }}
                  disabled={filteredProducts.length === 0}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          filteredProducts.length === 0
                            ? "Filtra por compañía/ramo"
                            : "Selecciona producto"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {filteredProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section title="Vigencia y moneda">
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
                <div className="flex items-end justify-between">
                  <FormLabel>Fin de vigencia</FormLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addOneYear}
                    className="-mb-1 h-7 px-2 text-xs"
                  >
                    <CalendarPlus className="size-3" /> +1 año
                  </Button>
                </div>
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
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {currencyLabel(c)} ({c})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section title="Cotización y destinatario">
          <FormField
            control={form.control}
            name="quotationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cotización origen</FormLabel>
                <Select
                  value={field.value || undefined}
                  onValueChange={(v) => field.onChange(v === "__NONE" ? "" : v)}
                  disabled={clientQuotations.length === 0}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          clientQuotations.length === 0
                            ? "Sin cotizaciones del cliente"
                            : "Sin vinculación"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__NONE">Ninguna</SelectItem>
                    {clientQuotations.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.quotationNumber}
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
            name="quotationNumberRef"
            render={({ field }) => (
              <FormItem>
                <FormLabel>N° cotización externo</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Si la cotización no está en Polizza"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="recipientContactId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contacto destinatario</FormLabel>
                <Select
                  value={field.value || undefined}
                  onValueChange={(v) => {
                    field.onChange(v === "__NONE" ? "" : v);
                    if (v && v !== "__NONE") {
                      const contact = selectedCompany?.contacts.find(
                        (c) => c.id === v,
                      );
                      if (contact?.email) {
                        form.setValue("recipientEmail", contact.email);
                      }
                    }
                  }}
                  disabled={!selectedCompany || selectedCompany.contacts.length === 0}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !selectedCompany
                            ? "Selecciona compañía primero"
                            : "Contacto default"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__NONE">Sin contacto</SelectItem>
                    {selectedCompany?.contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.email && `· ${c.email}`}
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
            name="recipientEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email destinatario</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section title="Comisión">
          <FormField
            control={form.control}
            name="commissionAffectPct"
            render={({ field }) => (
              <FormItem>
                <FormLabel>% Comisión afecta</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="0" {...field} />
                </FormControl>
                {selectedProduct?.commissionAffectPct !== null &&
                  selectedProduct?.commissionAffectPct !== undefined && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Default producto: {selectedProduct.commissionAffectPct}%
                    </p>
                  )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="commissionExemptPct"
            render={({ field }) => (
              <FormItem>
                <FormLabel>% Comisión exenta</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section title="Relación con otras compañías / corredores" cols={2}>
          <RelationsSection
            form={form}
            companies={catalog.companies}
            brokers={brokers}
            clientPolicies={clientPolicies}
          />
        </Section>


        <Section title="Observaciones y asignación">
          <FormField
            control={form.control}
            name="observations"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Observaciones generales</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    minHeightClass="min-h-[140px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
        </Section>

        <div className="flex flex-wrap items-center gap-3 border-t pt-5">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {currentMode === "create" ? "Crear propuesta" : "Guardar cambios"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onSaveDraft}
            disabled={isSubmitting}
          >
            <Save className="size-4" /> Guardar borrador
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

function Section({
  title,
  children,
  cols = 3,
}: {
  title: string;
  children: React.ReactNode;
  cols?: 2 | 3;
}) {
  return (
    <section className="space-y-3 border-t pt-5 first:border-t-0 first:pt-0">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div
        className={
          cols === 2
            ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
            : "grid grid-cols-1 gap-4 sm:grid-cols-3"
        }
      >
        {children}
      </div>
    </section>
  );
}

