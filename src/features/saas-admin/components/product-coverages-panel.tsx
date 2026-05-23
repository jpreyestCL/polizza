"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  upsertProductCoverageAction,
  deleteProductCoverageAction,
} from "../actions";
import {
  globalProductCoverageSchema,
  type GlobalProductCoverageValues,
} from "../schemas";
import type { GlobalProductCoverageRow } from "../queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";

const EMPTY: GlobalProductCoverageValues = {
  order: "0",
  name: "",
  polCad: "",
  text: "",
  insuredAmount: "",
  type: "COBERTURA",
  isCommercialValue: false,
  affectedByIva: false,
  sumsToTotal: true,
};

export function ProductCoveragesPanel({
  productId,
  coverages,
}: {
  productId: string;
  coverages: GlobalProductCoverageRow[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Coberturas preconfiguradas</h2>
        <CoverageDialog
          productId={productId}
          coverageId={null}
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> Agregar cobertura
            </Button>
          }
          initial={EMPTY}
        />
      </div>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Cobertura</th>
              <th className="px-3 py-2 text-left">POL/CAD</th>
              <th className="px-3 py-2 text-right">Monto asegurado</th>
              <th className="px-3 py-2 text-center">Tipo</th>
              <th className="px-3 py-2 text-center">Val. com.</th>
              <th className="px-3 py-2 text-center">IVA</th>
              <th className="px-3 py-2 text-center">Suma total</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {coverages.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Sin coberturas configuradas.
                </td>
              </tr>
            ) : (
              coverages.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-3 py-2 tabular-nums">{c.order}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{c.name}</div>
                    {c.text && (
                      <div className="text-xs text-muted-foreground">{c.text}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {c.polCad ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {c.insuredAmount !== null
                      ? c.insuredAmount.toLocaleString("es-CL")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge
                      variant={c.type === "COBERTURA" ? "default" : "secondary"}
                    >
                      {c.type === "COBERTURA" ? "Cobertura" : "Adicional"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c.isCommercialValue ? "✓" : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c.affectedByIva ? "✓" : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c.sumsToTotal ? "✓" : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <CoverageRowActions
                      productId={productId}
                      coverage={c}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CoverageRowActions({
  productId,
  coverage,
}: {
  productId: string;
  coverage: GlobalProductCoverageRow;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  async function handleDelete() {
    if (!confirm(`¿Eliminar la cobertura "${coverage.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteProductCoverageAction(coverage.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Cobertura eliminada");
      router.refresh();
    });
  }
  return (
    <div className="flex justify-end gap-1">
      <CoverageDialog
        productId={productId}
        coverageId={coverage.id}
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button variant="ghost" size="icon" aria-label="Editar">
            <Pencil className="size-3.5" />
          </Button>
        }
        initial={{
          order: String(coverage.order),
          name: coverage.name,
          polCad: coverage.polCad ?? "",
          text: coverage.text ?? "",
          insuredAmount:
            coverage.insuredAmount !== null ? String(coverage.insuredAmount) : "",
          type: coverage.type as "COBERTURA" | "ADICIONAL",
          isCommercialValue: coverage.isCommercialValue,
          affectedByIva: coverage.affectedByIva,
          sumsToTotal: coverage.sumsToTotal,
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Eliminar"
        onClick={handleDelete}
      >
        <Trash2 className="size-3.5 text-destructive" />
      </Button>
    </div>
  );
}

function CoverageDialog({
  productId,
  coverageId,
  open,
  onOpenChange,
  trigger,
  initial,
}: {
  productId: string;
  coverageId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger: React.ReactNode;
  initial: GlobalProductCoverageValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = globalProductCoverageSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const r = await upsertProductCoverageAction(
      productId,
      coverageId,
      parsed.data,
    );
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.success(coverageId ? "Cobertura actualizada" : "Cobertura agregada");
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{coverageId ? "Editar" : "Agregar"} cobertura</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div>
            <Label>Orden</Label>
            <Input
              type="number"
              value={values.order}
              onChange={(e) => setValues({ ...values, order: e.target.value })}
            />
          </div>
          <div>
            <Label>Tipo *</Label>
            <Select
              value={values.type}
              onValueChange={(v) =>
                setValues({ ...values, type: v as "COBERTURA" | "ADICIONAL" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COBERTURA">Cobertura</SelectItem>
                <SelectItem value="ADICIONAL">Adicional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Nombre cobertura *</Label>
            <Input
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>POL / CAD</Label>
            <Input
              value={values.polCad}
              onChange={(e) => setValues({ ...values, polCad: e.target.value })}
              className="font-mono"
            />
          </div>
          <div>
            <Label>Monto asegurado</Label>
            <Input
              type="number"
              step="0.01"
              value={values.insuredAmount}
              onChange={(e) =>
                setValues({ ...values, insuredAmount: e.target.value })
              }
            />
          </div>
          <div className="col-span-2">
            <Label>Texto cobertura</Label>
            <Textarea
              rows={2}
              value={values.text}
              onChange={(e) => setValues({ ...values, text: e.target.value })}
            />
          </div>
          <div className="col-span-2 flex flex-wrap gap-x-6 gap-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.isCommercialValue}
                onCheckedChange={(v) =>
                  setValues({ ...values, isCommercialValue: v === true })
                }
              />
              Valor comercial
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.affectedByIva}
                onCheckedChange={(v) =>
                  setValues({ ...values, affectedByIva: v === true })
                }
              />
              Afecto a IVA
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.sumsToTotal}
                onCheckedChange={(v) =>
                  setValues({ ...values, sumsToTotal: v === true })
                }
              />
              Suma al total
            </label>
          </div>
          {error && (
            <div className="col-span-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter className="col-span-2">
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
