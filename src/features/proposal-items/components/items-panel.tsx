"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { ItemCoveragesDialog } from "@/features/proposal-coverages/components/coverages-dialog";
import {
  createProposalItemAction,
  updateProposalItemAction,
  deleteProposalItemAction,
} from "../actions";
import type { BranchFieldDef, ProposalItemRow } from "../queries";
import { proposalItemSchema, type ProposalItemValues } from "../schemas";
import { DynamicFieldForm } from "./dynamic-field-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClientCombobox } from "@/components/ui/client-combobox";
import { QuickClientDialog } from "@/features/clients/components/quick-client-dialog";
import { BulkUploadDialog } from "./bulk-upload-dialog";

type BranchOption = { id: string; name: string };
type ClientOption = { id: string; name: string; rut?: string | null };

/**
 * Mapea cada llave de ramo a los campos que deben mostrarse en el resumen
 * del listado de ítems (línea principal "Identificación" y línea secundaria
 * "Bajo identificación"). Definido por el cliente — ver Libro4.xlsx.
 */
const BRANCH_SUMMARY: Record<
  string,
  { identification: string[]; secondary: string | "__GLOSS__" }
> = {
  incendio: {
    identification: ["direccion", "comuna", "ciudad"],
    secondary: "descripcion_materia",
  },
  todo_riesgo_construccion: {
    identification: ["direccion", "comuna", "ciudad"],
    secondary: "descripcion_materia",
  },
  todo_riesgo_bienes: {
    identification: ["direccion", "comuna", "ciudad"],
    secondary: "descripcion_materia",
  },
  accidentes_personales_nominados: {
    identification: ["nombre", "apellido_paterno", "rut_asegurado"],
    secondary: "__GLOSS__",
  },
  accidentes_personales_innominados: {
    identification: ["descripcion_riesgo"],
    secondary: "__GLOSS__",
  },
  responsabilidad_civil: {
    identification: ["descripcion_riesgo"],
    secondary: "__GLOSS__",
  },
  garantia: {
    identification: ["descripcion_riesgo"],
    secondary: "__GLOSS__",
  },
  equipo_movil_individualizado: {
    identification: ["tipo", "marca", "modelo", "anio", "patente"],
    secondary: "__GLOSS__",
  },
  vehiculos_motorizados: {
    identification: ["tipo", "marca", "modelo", "anio", "patente"],
    secondary: "__GLOSS__",
  },
  soap: {
    identification: ["tipo", "marca", "modelo", "anio", "patente"],
    secondary: "__GLOSS__",
  },
  equipo_movil_general: {
    identification: ["descripcion_riesgo"],
    secondary: "__GLOSS__",
  },
  transporte: {
    identification: ["descripcion_riesgo"],
    secondary: "__GLOSS__",
  },
  casco_maritimo: {
    identification: ["tipo_nave", "nombre_nave", "matricula"],
    secondary: "__GLOSS__",
  },
  casco_aereo: {
    identification: ["tipo_aeronave", "marca", "modelo", "matricula"],
    secondary: "__GLOSS__",
  },
  vida_salud: {
    identification: ["nombre", "apellido_paterno", "rut_asegurado"],
    secondary: "__GLOSS__",
  },
};

function formatFieldValue(
  fieldKey: string,
  raw: unknown,
  fields: BranchFieldDef[],
): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const field = fields.find((f) => f.fieldKey === fieldKey);
  if (field?.type === "select" && field.options) {
    const opt = field.options.find((o) => o.value === raw);
    if (opt) return opt.label;
  }
  return String(raw);
}

function buildItemSummary(
  branchKey: string,
  data: Record<string, unknown>,
  glossNote: string | null,
  identification: string | null,
  fields: BranchFieldDef[],
): { identification: string; secondary: string | null } {
  const config = BRANCH_SUMMARY[branchKey];
  if (!config) {
    return {
      identification:
        identification ??
        (Object.values(data).find(
          (v) => typeof v === "string" && v.length > 0,
        ) as string | undefined) ??
        "—",
      secondary: glossNote,
    };
  }
  const parts = config.identification
    .map((k) => formatFieldValue(k, data[k], fields))
    .filter((v): v is string => Boolean(v));
  const ident =
    parts.length > 0 ? parts.join(" · ") : (identification ?? "—");
  const secondary =
    config.secondary === "__GLOSS__"
      ? glossNote
      : formatFieldValue(
          config.secondary,
          data[config.secondary],
          fields,
        );
  return { identification: ident, secondary };
}

export function ProposalItemsPanel({
  proposalId,
  productId,
  items,
  branches,
  clients,
  fieldSchemasByBranch,
  defaultBranchTypeId,
  defaultInsuredId,
  defaultInsuredName,
  defaultInsuredRut,
  defaultBeneficiaryId,
  defaultBeneficiaryName,
  defaultBeneficiaryRut,
  defaultCommissionAffectPct,
  defaultCommissionExemptPct,
  locked = false,
}: {
  proposalId: string;
  productId: string | null;
  items: ProposalItemRow[];
  branches: BranchOption[];
  clients: ClientOption[];
  fieldSchemasByBranch: Record<string, BranchFieldDef[]>;
  defaultBranchTypeId: string | null;
  defaultInsuredId: string | null;
  defaultInsuredName?: string | null;
  defaultInsuredRut?: string | null;
  defaultBeneficiaryId: string | null;
  defaultBeneficiaryName?: string | null;
  defaultBeneficiaryRut?: string | null;
  defaultCommissionAffectPct?: number | null;
  defaultCommissionExemptPct?: number | null;
  locked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const EMPTY: ProposalItemValues = {
    branchTypeId: defaultBranchTypeId ?? "",
    insuredClientId: defaultInsuredId ?? "",
    beneficiaryClientId: defaultBeneficiaryId ?? "",
    identification: "",
    glossNote: "",
    data: {},
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Ítems de la propuesta</h2>
          <p className="text-xs text-muted-foreground">
            La ficha de datos depende del ramo del ítem. Los asegurados y
            beneficiarios heredan de la propuesta por defecto.
          </p>
        </div>
        {!locked && (
          <div className="flex gap-2">
            <BulkUploadDialog
              proposalId={proposalId}
              open={bulkOpen}
              onOpenChange={setBulkOpen}
              branches={branches}
              fieldSchemasByBranch={fieldSchemasByBranch}
            />
            <ItemDialog
              proposalId={proposalId}
              itemId={null}
              open={open}
              onOpenChange={setOpen}
              trigger={
                <Button>
                  <Plus className="size-4" /> Nuevo ítem
                </Button>
              }
              initial={EMPTY}
              branches={branches}
              clients={clients}
              fieldSchemasByBranch={fieldSchemasByBranch}
            />
          </div>
        )}
      </div>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Identificación / Resumen</th>
              <th className="px-3 py-2 text-left">Asegurado</th>
              <th className="px-3 py-2 text-left">Beneficiario</th>
              <th className="px-3 py-2 text-center">Cobs</th>
              <th className="px-3 py-2 text-right">Monto asegurado</th>
              <th className="px-3 py-2 text-right">Prima neta</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  Aún no hay ítems en esta propuesta.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <ItemRow
                  key={item.id}
                  idx={idx + 1}
                  item={item}
                  productId={productId}
                  branches={branches}
                  clients={clients}
                  fieldSchemasByBranch={fieldSchemasByBranch}
                  defaultInsuredName={defaultInsuredName ?? null}
                  defaultInsuredRut={defaultInsuredRut ?? null}
                  defaultBeneficiaryName={defaultBeneficiaryName ?? null}
                  defaultBeneficiaryRut={defaultBeneficiaryRut ?? null}
                  defaultCommissionAffectPct={
                    defaultCommissionAffectPct ?? null
                  }
                  defaultCommissionExemptPct={
                    defaultCommissionExemptPct ?? null
                  }
                  locked={locked}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ItemRow({
  idx,
  item,
  productId,
  branches,
  clients,
  fieldSchemasByBranch,
  defaultInsuredName,
  defaultInsuredRut,
  defaultBeneficiaryName,
  defaultBeneficiaryRut,
  defaultCommissionAffectPct,
  defaultCommissionExemptPct,
  locked,
}: {
  idx: number;
  item: ProposalItemRow;
  productId: string | null;
  branches: BranchOption[];
  clients: ClientOption[];
  fieldSchemasByBranch: Record<string, BranchFieldDef[]>;
  defaultInsuredName: string | null;
  defaultInsuredRut: string | null;
  defaultBeneficiaryName: string | null;
  defaultBeneficiaryRut: string | null;
  defaultCommissionAffectPct: number | null;
  defaultCommissionExemptPct: number | null;
  locked: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  async function handleDelete() {
    if (!confirm(`¿Eliminar el ítem ${idx}?`)) return;
    startTransition(async () => {
      const r = await deleteProposalItemAction(item.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Ítem eliminado");
      router.refresh();
    });
  }

  const branchFields = fieldSchemasByBranch[item.branchTypeId] ?? [];
  const { identification: summary, secondary: fichaDescription } =
    buildItemSummary(
      item.branchTypeKey,
      item.data,
      item.glossNote,
      item.identification,
      branchFields,
    );

  // Asegurado / beneficiario con fallback al default de la carátula. Cuando
  // se hereda mostramos el nombre + RUT del contratante por defecto y una
  // marca discreta "(de carátula)".
  const insuredName = item.insuredClientName ?? defaultInsuredName;
  const insuredRut = item.insuredClientName
    ? item.insuredClientRut
    : defaultInsuredRut;
  const insuredIsDefault = !item.insuredClientId;
  const beneficiaryName =
    item.beneficiaryClientName ?? defaultBeneficiaryName;
  const beneficiaryRut = item.beneficiaryClientName
    ? item.beneficiaryClientRut
    : defaultBeneficiaryRut;
  const beneficiaryIsDefault = !item.beneficiaryClientId;

  return (
    <tr className="border-b last:border-0 align-top">
      <td className="px-3 py-2 tabular-nums">{idx}</td>
      <td className="px-3 py-2 max-w-[360px]">
        <div className="font-medium leading-snug">{summary}</div>
        {fichaDescription && (
          <div className="mt-0.5 line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">
            {fichaDescription}
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <ClientCell
          name={insuredName}
          rut={insuredRut}
          isDefault={insuredIsDefault}
        />
      </td>
      <td className="px-3 py-2">
        <ClientCell
          name={beneficiaryName}
          rut={beneficiaryRut}
          isDefault={beneficiaryIsDefault}
        />
      </td>
      <td className="px-3 py-2 text-center">{item.coveragesCount}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        <InsuredAmountCell coverages={item.coverages} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {item.totalNetPremium > 0
          ? item.totalNetPremium.toLocaleString("es-CL", {
              maximumFractionDigits: 2,
            })
          : "—"}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <ItemCoveragesDialog
            itemId={item.id}
            itemLabel={`#${idx} · ${item.branchTypeName}`}
            coverages={item.coverages}
            productId={productId}
            defaultCommissionAffectPct={defaultCommissionAffectPct}
            defaultCommissionExemptPct={defaultCommissionExemptPct}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Coberturas"
                title="Coberturas"
              >
                <Receipt className="size-3.5" />
              </Button>
            }
          />
          {!locked && (
            <>
              <ItemDialog
                proposalId={""}
                itemId={item.id}
                open={open}
                onOpenChange={setOpen}
                trigger={
                  <Button variant="ghost" size="icon" aria-label="Editar">
                    <Pencil className="size-3.5" />
                  </Button>
                }
                initial={{
                  branchTypeId: item.branchTypeId,
                  insuredClientId: item.insuredClientId ?? "",
                  beneficiaryClientId: item.beneficiaryClientId ?? "",
                  identification: item.identification ?? "",
                  glossNote: item.glossNote ?? "",
                  data: item.data,
                }}
                branches={branches}
                clients={clients}
                fieldSchemasByBranch={fieldSchemasByBranch}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Eliminar"
                onClick={handleDelete}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Suma de montos asegurados de las coberturas que tienen `sumsToTotal`.
 * Si hay varias monedas distintas las muestra agrupadas; lo común es que
 * compartan moneda y se muestre un único renglón.
 */
function InsuredAmountCell({
  coverages,
}: {
  coverages: { insuredAmount: number | null; insuredCurrency: string; sumsToTotal: boolean }[];
}) {
  const totals = new Map<string, number>();
  for (const c of coverages) {
    if (!c.sumsToTotal) continue;
    const amt = c.insuredAmount ?? 0;
    if (!amt) continue;
    totals.set(c.insuredCurrency, (totals.get(c.insuredCurrency) ?? 0) + amt);
  }
  if (totals.size === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5">
      {Array.from(totals.entries()).map(([currency, amount]) => (
        <div key={currency}>
          {amount.toLocaleString("es-CL", { maximumFractionDigits: 2 })}{" "}
          <span className="text-xs text-muted-foreground">{currency}</span>
        </div>
      ))}
    </div>
  );
}

function ClientCell({
  name,
  rut,
  isDefault,
}: {
  name: string | null;
  rut: string | null;
  isDefault: boolean;
}) {
  if (!name) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="space-y-0.5">
      <div className="leading-snug">{name}</div>
      {rut && (
        <div className="text-xs tabular-nums text-muted-foreground">{rut}</div>
      )}
      {isDefault && (
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          de carátula
        </div>
      )}
    </div>
  );
}

function ItemDialog({
  proposalId,
  itemId,
  open,
  onOpenChange,
  trigger,
  initial,
  branches,
  clients,
  fieldSchemasByBranch,
}: {
  proposalId: string;
  itemId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger: React.ReactNode;
  initial: ProposalItemValues;
  branches: BranchOption[];
  clients: ClientOption[];
  fieldSchemasByBranch: Record<string, BranchFieldDef[]>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localClients, setLocalClients] = useState<ClientOption[]>(clients);
  const [createDialog, setCreateDialog] = useState<{
    field: "insuredClientId" | "beneficiaryClientId";
    defaultRut: string;
    defaultName: string;
  } | null>(null);

  const currentFields = fieldSchemasByBranch[values.branchTypeId] ?? [];

  // Si la ficha del ramo ya pregunta "comentarios" o "glosa", evitamos
  // mostrar el textarea hardcoded para no duplicar.
  const hasFichaGlosa = currentFields.some((f) =>
    ["comentarios", "glosa", "descripcion_riesgo"].includes(
      f.fieldKey.toLowerCase(),
    ),
  );

  function openCreateClient(
    field: "insuredClientId" | "beneficiaryClientId",
    query: string,
  ) {
    const trimmed = query.trim();
    const looksLikeRut = /[0-9]/.test(trimmed) && trimmed.length <= 12;
    setCreateDialog({
      field,
      defaultRut: looksLikeRut ? trimmed : "",
      defaultName: looksLikeRut ? "" : trimmed,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = proposalItemSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const r = itemId
      ? await updateProposalItemAction(itemId, parsed.data)
      : await createProposalItemAction(proposalId, parsed.data);
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.success(itemId ? "Ítem actualizado" : "Ítem creado");
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {itemId ? "Editar ítem" : "Nuevo ítem"}
          </DialogTitle>
          <DialogDescription>
            La ficha de datos cambia según el ramo seleccionado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
            Ramo:{" "}
            <span className="font-medium">
              {branches.find((b) => b.id === values.branchTypeId)?.name ??
                "(heredado de la propuesta)"}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">
                Asegurado{" "}
                <span className="font-normal text-muted-foreground">
                  (deja vacío para usar default carátula)
                </span>
              </Label>
              <ClientCombobox
                value={values.insuredClientId}
                onChange={(id, c) => {
                  setValues({ ...values, insuredClientId: id });
                  if (c && !localClients.some((x) => x.id === c.id)) {
                    setLocalClients((p) => [
                      ...p,
                      { id: c.id, name: c.name, rut: c.rut ?? null },
                    ]);
                  }
                }}
                initial={
                  localClients.find((c) => c.id === values.insuredClientId) ??
                  null
                }
                placeholder="Buscar por nombre o RUT"
                onCreate={(q) => openCreateClient("insuredClientId", q)}
              />
            </div>
            <div>
              <Label className="text-xs">
                Beneficiario{" "}
                <span className="font-normal text-muted-foreground">
                  (deja vacío para usar default carátula)
                </span>
              </Label>
              <ClientCombobox
                value={values.beneficiaryClientId}
                onChange={(id, c) => {
                  setValues({ ...values, beneficiaryClientId: id });
                  if (c && !localClients.some((x) => x.id === c.id)) {
                    setLocalClients((p) => [
                      ...p,
                      { id: c.id, name: c.name, rut: c.rut ?? null },
                    ]);
                  }
                }}
                initial={
                  localClients.find(
                    (c) => c.id === values.beneficiaryClientId,
                  ) ?? null
                }
                placeholder="Buscar por nombre o RUT"
                onCreate={(q) => openCreateClient("beneficiaryClientId", q)}
              />
            </div>
          </div>
          {createDialog && (
            <QuickClientDialog
              open
              trigger={null}
              onOpenChange={(v) => {
                if (!v) setCreateDialog(null);
              }}
              defaultRut={createDialog.defaultRut}
              defaultName={createDialog.defaultName}
              onCreated={(id, name) => {
                setLocalClients((p) =>
                  p.some((c) => c.id === id) ? p : [...p, { id, name }],
                );
                setValues((v) => ({
                  ...v,
                  [createDialog.field]: id,
                }));
                setCreateDialog(null);
              }}
            />
          )}

          {values.branchTypeId && currentFields.length > 0 && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ficha del ramo
              </div>
              <DynamicFieldForm
                fields={currentFields}
                values={values.data}
                onChange={(data) => setValues({ ...values, data })}
              />
            </div>
          )}
          {values.branchTypeId && currentFields.length === 0 && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              El ramo seleccionado no tiene ficha de datos definida.
            </div>
          )}

          {!hasFichaGlosa && (
            <div>
              <Label className="text-xs">Glosa / comentario</Label>
              <Textarea
                rows={3}
                value={values.glossNote}
                onChange={(e) =>
                  setValues({ ...values, glossNote: e.target.value })
                }
                placeholder="Notas adicionales para este ítem"
              />
            </div>
          )}

          {error && (
            <div className="whitespace-pre-line rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
