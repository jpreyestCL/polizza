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
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BulkUploadDialog } from "./bulk-upload-dialog";

type BranchOption = { id: string; name: string };
type ClientOption = { id: string; name: string };

export function ProposalItemsPanel({
  proposalId,
  productId,
  items,
  branches,
  clients,
  fieldSchemasByBranch,
  defaultBranchTypeId,
  defaultInsuredId,
  defaultBeneficiaryId,
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
  defaultBeneficiaryId: string | null;
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
              <th className="px-3 py-2 text-right">Prima neta</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
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
  locked,
}: {
  idx: number;
  item: ProposalItemRow;
  productId: string | null;
  branches: BranchOption[];
  clients: ClientOption[];
  fieldSchemasByBranch: Record<string, BranchFieldDef[]>;
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

  // Summary: identificación o primer valor relevante del data JSON
  const summary =
    item.identification ??
    (item.data?.patente as string | undefined) ??
    (item.data?.direccion as string | undefined) ??
    (item.data?.nombre_nave as string | undefined) ??
    (item.data?.descripcion_riesgo as string | undefined) ??
    "—";

  // Descripción/comentarios/glosa específicos de la ficha del ramo.
  const fichaDescription =
    (item.data?.descripcion as string | undefined) ??
    (item.data?.descripcion_riesgo as string | undefined) ??
    (item.data?.comentarios as string | undefined) ??
    (item.data?.glosa as string | undefined) ??
    null;

  return (
    <tr className="border-b last:border-0 align-top">
      <td className="px-3 py-2 tabular-nums">{idx}</td>
      <td className="px-3 py-2 max-w-[320px]">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {item.branchTypeName}
          </Badge>
          <span className="truncate font-medium">{summary}</span>
        </div>
        {fichaDescription && (
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {fichaDescription}
          </div>
        )}
        {item.glossNote && (
          <div className="mt-0.5 line-clamp-2 text-xs italic text-muted-foreground">
            {item.glossNote}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {item.insuredClientName ?? "—"}
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {item.beneficiaryClientName ?? "—"}
      </td>
      <td className="px-3 py-2 text-center">{item.coveragesCount}</td>
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

  const currentFields = fieldSchemasByBranch[values.branchTypeId] ?? [];

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
              <Label className="text-xs">Asegurado</Label>
              <Select
                value={values.insuredClientId || undefined}
                onValueChange={(v) =>
                  setValues({
                    ...values,
                    insuredClientId: v === "__DEFAULT" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Default (carátula)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__DEFAULT">— Default carátula —</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Beneficiario</Label>
              <Select
                value={values.beneficiaryClientId || undefined}
                onValueChange={(v) =>
                  setValues({
                    ...values,
                    beneficiaryClientId: v === "__DEFAULT" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Default (carátula)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__DEFAULT">— Default carátula —</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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
