"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  createTenantCoverageAction,
  updateTenantCoverageAction,
  deleteTenantCoverageAction,
  bulkCopyCoveragesAction,
} from "../coverages-actions";
import type { ProductCoverageRow } from "../coverages-queries";
import {
  tenantCoverageFormSchema,
  type TenantCoverageFormValues,
} from "../coverages-schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

type OtherProduct = {
  id: string;
  name: string;
  insuranceCompany: { name: string };
};

const EMPTY: TenantCoverageFormValues = {
  order: "",
  name: "",
  factor: "",
  polCad: "",
  text: "",
  isCommercialValue: false,
  insuredAmount: "",
  type: "COBERTURA",
  affectedByIva: false,
  sumsToTotal: true,
  premium: "",
};

export function ProductCoveragesGrid({
  productId,
  productName,
  coverages,
  otherProducts,
}: {
  productId: string;
  productName: string;
  coverages: ProductCoverageRow[];
  otherProducts: OtherProduct[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<TenantCoverageFormValues>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edited, setEdited] = useState<TenantCoverageFormValues>(EMPTY);
  const [copyOpen, setCopyOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSaveNew() {
    const parsed = tenantCoverageFormSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    startTransition(async () => {
      const r = await createTenantCoverageAction(productId, parsed.data);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Cobertura creada");
      setDraft(EMPTY);
      router.refresh();
    });
  }

  function startEdit(c: ProductCoverageRow) {
    setEditingId(c.id);
    setEdited({
      order: String(c.order),
      name: c.name,
      factor: c.factor !== null ? String(c.factor) : "",
      polCad: c.polCad ?? "",
      text: c.text ?? "",
      isCommercialValue: c.isCommercialValue,
      insuredAmount: c.insuredAmount !== null ? String(c.insuredAmount) : "",
      type: (c.type as "COBERTURA" | "ADICIONAL") ?? "COBERTURA",
      affectedByIva: c.affectedByIva,
      sumsToTotal: c.sumsToTotal,
      premium: c.premium !== null ? String(c.premium) : "",
    });
  }

  function handleSaveEdit() {
    if (!editingId) return;
    const parsed = tenantCoverageFormSchema.safeParse(edited);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    startTransition(async () => {
      const r = await updateTenantCoverageAction(editingId, parsed.data);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Cobertura actualizada");
      setEditingId(null);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta cobertura?")) return;
    startTransition(async () => {
      const r = await deleteTenantCoverageAction(id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Cobertura eliminada");
      router.refresh();
    });
  }

  function handleCopy() {
    if (!sourceId) {
      toast.error("Selecciona un producto origen");
      return;
    }
    startTransition(async () => {
      const r = await bulkCopyCoveragesAction(sourceId, productId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Copiadas ${r.data?.count ?? 0} coberturas`);
      setCopyOpen(false);
      setSourceId("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Coberturas — {productName}</h2>
          <p className="text-xs text-muted-foreground">
            Estas coberturas se cargan automáticamente cuando agregas un ítem a
            una propuesta de este producto.
          </p>
        </div>
        <Button variant="outline" onClick={() => setCopyOpen(true)}>
          <Copy className="size-4" /> Copiar coberturas de otro producto/cía
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-xs">
          <thead className="border-b bg-muted/40 text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">Orden</th>
              <th className="px-2 py-2 text-left">Nombre cobertura</th>
              <th className="px-2 py-2 text-right">Factor</th>
              <th className="px-2 py-2 text-left">POL-CAD</th>
              <th className="px-2 py-2 text-left">Texto</th>
              <th className="px-2 py-2 text-center">V. Com.</th>
              <th className="px-2 py-2 text-right">Mto. Aseg.</th>
              <th className="px-2 py-2 text-left">Tipo</th>
              <th className="px-2 py-2 text-center">IVA</th>
              <th className="px-2 py-2 text-center">Suma total</th>
              <th className="px-2 py-2 text-right">Prima</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            <CoverageEditableRow
              isNew
              values={draft}
              onChange={setDraft}
              onSave={handleSaveNew}
              onCancel={() => setDraft(EMPTY)}
              pending={pending}
            />
            {coverages.map((c) =>
              editingId === c.id ? (
                <CoverageEditableRow
                  key={c.id}
                  values={edited}
                  onChange={setEdited}
                  onSave={handleSaveEdit}
                  onCancel={() => setEditingId(null)}
                  pending={pending}
                />
              ) : (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-2 py-1.5 tabular-nums">{c.order}</td>
                  <td className="px-2 py-1.5 font-medium">{c.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {c.factor ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">
                    {c.polCad ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 max-w-[160px] truncate">
                    {c.text ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {c.isCommercialValue ? "✓" : ""}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {c.insuredAmount?.toLocaleString("es-CL") ?? "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    <Badge variant={c.type === "COBERTURA" ? "default" : "secondary"}>
                      {c.type === "COBERTURA" ? "Cob" : "Adi"}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {c.affectedByIva ? "✓" : ""}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {c.sumsToTotal ? "✓" : ""}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {c.premium?.toLocaleString("es-CL") ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar"
                        onClick={() => startEdit(c)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar"
                        onClick={() => handleDelete(c.id)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {coverages.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  Sin coberturas. Agrega una arriba o copia de otro producto.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copiar coberturas de otro producto</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Producto origen</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona producto" />
              </SelectTrigger>
              <SelectContent>
                {otherProducts
                  .filter((p) => p.id !== productId)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.insuranceCompany.name} · {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Las coberturas existentes en {productName} se conservan; las del
              origen se agregan al final.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCopyOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCopy} disabled={pending}>
              <Copy className="size-4" /> Copiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CoverageEditableRow({
  values,
  onChange,
  onSave,
  onCancel,
  pending,
  isNew = false,
}: {
  values: TenantCoverageFormValues;
  onChange: (v: TenantCoverageFormValues) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  isNew?: boolean;
}) {
  function set<K extends keyof TenantCoverageFormValues>(
    key: K,
    v: TenantCoverageFormValues[K],
  ) {
    onChange({ ...values, [key]: v });
  }
  return (
    <tr className={"border-b " + (isNew ? "bg-muted/20" : "bg-amber-50/20")}>
      <td className="px-2 py-1.5">
        <Input
          className="h-7 w-14 px-1 text-xs"
          inputMode="numeric"
          value={values.order}
          onChange={(e) => set("order", e.target.value)}
        />
      </td>
      <td className="px-2 py-1.5">
        <Input
          className="h-7 px-1 text-xs"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Nombre"
        />
      </td>
      <td className="px-2 py-1.5">
        <Input
          className="h-7 w-16 px-1 text-right text-xs"
          inputMode="decimal"
          value={values.factor}
          onChange={(e) => set("factor", e.target.value)}
        />
      </td>
      <td className="px-2 py-1.5">
        <Input
          className="h-7 w-16 px-1 text-xs"
          value={values.polCad}
          onChange={(e) => set("polCad", e.target.value)}
        />
      </td>
      <td className="px-2 py-1.5">
        <Input
          className="h-7 px-1 text-xs"
          value={values.text}
          onChange={(e) => set("text", e.target.value)}
        />
      </td>
      <td className="px-2 py-1.5 text-center">
        <Checkbox
          checked={values.isCommercialValue}
          onCheckedChange={(v) => set("isCommercialValue", v === true)}
        />
      </td>
      <td className="px-2 py-1.5">
        <Input
          className="h-7 w-24 px-1 text-right text-xs"
          inputMode="decimal"
          value={values.insuredAmount}
          onChange={(e) => set("insuredAmount", e.target.value)}
        />
      </td>
      <td className="px-2 py-1.5">
        <Select
          value={values.type}
          onValueChange={(v) => set("type", v as "COBERTURA" | "ADICIONAL")}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="COBERTURA">Cobertura</SelectItem>
            <SelectItem value="ADICIONAL">Adicional</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-1.5 text-center">
        <Checkbox
          checked={values.affectedByIva}
          onCheckedChange={(v) => set("affectedByIva", v === true)}
        />
      </td>
      <td className="px-2 py-1.5 text-center">
        <Checkbox
          checked={values.sumsToTotal}
          onCheckedChange={(v) => set("sumsToTotal", v === true)}
        />
      </td>
      <td className="px-2 py-1.5">
        <Input
          className="h-7 w-20 px-1 text-right text-xs"
          inputMode="decimal"
          value={values.premium}
          onChange={(e) => set("premium", e.target.value)}
        />
      </td>
      <td className="px-2 py-1.5 text-right">
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Grabar"
            onClick={onSave}
            disabled={pending}
          >
            <Save className="size-3.5" />
          </Button>
          {!isNew && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Cancelar"
              onClick={onCancel}
              disabled={pending}
            >
              <X className="size-3.5" />
            </Button>
          )}
          {isNew && (
            <span className="self-center text-[10px] text-muted-foreground">
              <Plus className="inline size-3" /> Nueva
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
