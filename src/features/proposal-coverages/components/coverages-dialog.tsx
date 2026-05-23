"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import {
  upsertItemCoverageAction,
  deleteItemCoverageAction,
  copyProductCoveragesAction,
} from "../actions";
import {
  itemCoverageSchema,
  computeCoverage,
  type ItemCoverageValues,
} from "../schemas";
import type { ItemCoverageRow } from "../queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const EMPTY: ItemCoverageValues = {
  order: "0",
  name: "",
  polCad: "",
  type: "COBERTURA",
  isCommercialValue: false,
  insuredAmount: "",
  insuredCurrency: "UF",
  affectedByIva: false,
  taxRateAffect: "",
  taxRateExempt: "",
  premiumAffect: "",
  premiumExempt: "",
  commissionAffectPct: "",
  commissionExemptPct: "",
  sumsToTotal: true,
  manualPremium: false,
};

export function ItemCoveragesDialog({
  itemId,
  itemLabel,
  coverages,
  productId,
  trigger,
}: {
  itemId: string;
  itemLabel: string;
  coverages: ItemCoverageRow[];
  productId: string | null;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ItemCoverageRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  async function handleCopyFromProduct() {
    if (!productId) {
      toast.error("La propuesta no tiene producto asociado");
      return;
    }
    const r = await copyProductCoveragesAction(itemId);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`${r.data?.count ?? 0} coberturas copiadas`);
    router.refresh();
  }

  async function handleDelete(coverageId: string) {
    if (!confirm("¿Eliminar la cobertura?")) return;
    const r = await deleteItemCoverageAction(coverageId);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Cobertura eliminada");
    router.refresh();
  }

  const totals = coverages.reduce(
    (acc, c) => {
      acc.net += c.premiumNet ?? 0;
      acc.iva += c.ivaAmount ?? 0;
      acc.gross += c.premiumGross ?? 0;
      acc.commission += c.commissionAmount ?? 0;
      return acc;
    },
    { net: 0, iva: 0, gross: 0, commission: 0 },
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Coberturas · {itemLabel}</DialogTitle>
            <DialogDescription>
              Las coberturas calculan prima neta = afecta + exenta; IVA = afecta × 19% (si aplica); prima bruta = neta + IVA; comisión = afecta×%afecta + exenta×%exenta.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyFromProduct}
              disabled={!productId}
            >
              <Copy className="size-4" /> Copiar del producto
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" /> Agregar cobertura
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/40 uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left">Tipo</th>
                  <th className="px-2 py-1.5 text-left">Cobertura</th>
                  <th className="px-2 py-1.5 text-right">Mto. aseg.</th>
                  <th className="px-2 py-1.5 text-right">T. afe</th>
                  <th className="px-2 py-1.5 text-right">T. exe</th>
                  <th className="px-2 py-1.5 text-right">P. afe</th>
                  <th className="px-2 py-1.5 text-right">P. exe</th>
                  <th className="px-2 py-1.5 text-right">Neta</th>
                  <th className="px-2 py-1.5 text-right">IVA</th>
                  <th className="px-2 py-1.5 text-right">Bruta</th>
                  <th className="px-2 py-1.5 text-right">% c.afe</th>
                  <th className="px-2 py-1.5 text-right">% c.exe</th>
                  <th className="px-2 py-1.5 text-right">Mto. com.</th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {coverages.length === 0 ? (
                  <tr>
                    <td
                      colSpan={14}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      Sin coberturas. Copia las del producto o agrega manualmente.
                    </td>
                  </tr>
                ) : (
                  coverages.map((c) => (
                    <tr
                      key={c.id}
                      className={
                        "border-b last:border-0" +
                        (c.autoLoaded ? " bg-muted/30" : "")
                      }
                      title={c.autoLoaded ? "Cobertura cargada automáticamente" : undefined}
                    >
                      <td className="px-2 py-1.5">
                        <Badge
                          variant={c.type === "COBERTURA" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {c.type === "COBERTURA" ? "Cob" : "Adi"}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="font-medium">{c.name}</div>
                        {c.polCad && (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {c.polCad}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmt(c.insuredAmount)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmtPct(c.taxRateAffect, 4)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmtPct(c.taxRateExempt, 4)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmt(c.premiumAffect)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmt(c.premiumExempt)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                        {fmt(c.premiumNet)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmt(c.ivaAmount)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                        {fmt(c.premiumGross)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmtPct(c.commissionAffectPct)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmtPct(c.commissionExemptPct)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmt(c.commissionAmount)}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar"
                            className="size-7"
                            onClick={() => {
                              setEditing(c);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Eliminar"
                            className="size-7"
                            onClick={() => handleDelete(c.id)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {coverages.length > 0 && (
                <tfoot className="border-t bg-muted/30">
                  <tr>
                    <td colSpan={7} className="px-2 py-1.5 text-right font-medium">
                      Totales:
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                      {fmt(totals.net)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {fmt(totals.iva)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                      {fmt(totals.gross)}
                    </td>
                    <td colSpan={2}></td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                      {fmt(totals.commission)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CoverageFormDialog
        itemId={itemId}
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing ? rowToValues(editing) : EMPTY}
        coverageId={editing?.id ?? null}
      />
    </>
  );
}

function rowToValues(c: ItemCoverageRow): ItemCoverageValues {
  return {
    order: String(c.order),
    name: c.name,
    polCad: c.polCad ?? "",
    type: c.type as "COBERTURA" | "ADICIONAL",
    isCommercialValue: c.isCommercialValue,
    insuredAmount: c.insuredAmount !== null ? String(c.insuredAmount) : "",
    insuredCurrency: c.insuredCurrency,
    affectedByIva: c.affectedByIva,
    taxRateAffect: c.taxRateAffect !== null ? String(c.taxRateAffect) : "",
    taxRateExempt: c.taxRateExempt !== null ? String(c.taxRateExempt) : "",
    premiumAffect: c.premiumAffect !== null ? String(c.premiumAffect) : "",
    premiumExempt: c.premiumExempt !== null ? String(c.premiumExempt) : "",
    commissionAffectPct:
      c.commissionAffectPct !== null ? String(c.commissionAffectPct) : "",
    commissionExemptPct:
      c.commissionExemptPct !== null ? String(c.commissionExemptPct) : "",
    sumsToTotal: c.sumsToTotal,
    manualPremium: c.manualPremium,
  };
}

function CoverageFormDialog({
  itemId,
  coverageId,
  open,
  onOpenChange,
  initial,
}: {
  itemId: string;
  coverageId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ItemCoverageValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recompute preview
  const calc = computeCoverage(values);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = itemCoverageSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const r = await upsertItemCoverageAction(itemId, coverageId, parsed.data);
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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {coverageId ? "Editar cobertura" : "Nueva cobertura"}
          </DialogTitle>
          <DialogDescription>
            Tasas en por mil (‰). El cálculo se actualiza en vivo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label className="text-xs">Cobertura *</Label>
              <Input
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label className="text-xs">POL/CAD</Label>
              <Input
                value={values.polCad}
                onChange={(e) =>
                  setValues({ ...values, polCad: e.target.value })
                }
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
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
            <div>
              <Label className="text-xs">Monto asegurado</Label>
              <Input
                type="number"
                step="0.01"
                value={values.insuredAmount}
                onChange={(e) =>
                  setValues({ ...values, insuredAmount: e.target.value })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Moneda</Label>
              <Select
                value={values.insuredCurrency}
                onValueChange={(v) =>
                  setValues({ ...values, insuredCurrency: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["UF", "CLP", "USD", "USD_OBS", "EUR", "UD"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Orden</Label>
              <Input
                type="number"
                value={values.order}
                onChange={(e) =>
                  setValues({ ...values, order: e.target.value })
                }
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={values.isCommercialValue}
                  onCheckedChange={(v) =>
                    setValues({ ...values, isCommercialValue: v === true })
                  }
                />
                Valor comercial
              </label>
            </div>
          </div>

          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cálculo de prima
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={values.manualPremium}
                  onCheckedChange={(v) =>
                    setValues({ ...values, manualPremium: v === true })
                  }
                />
                Cálculo manual (ingreso directo)
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {!values.manualPremium && (
                <>
                  <div>
                    <Label className="text-xs">Tasa afecta ‰</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={values.taxRateAffect}
                      onChange={(e) =>
                        setValues({ ...values, taxRateAffect: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Tasa exenta ‰</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={values.taxRateExempt}
                      onChange={(e) =>
                        setValues({ ...values, taxRateExempt: e.target.value })
                      }
                    />
                  </div>
                </>
              )}
              <div>
                <Label className="text-xs">Prima afecta</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={values.premiumAffect}
                  disabled={!values.manualPremium}
                  onChange={(e) =>
                    setValues({ ...values, premiumAffect: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Prima exenta</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={values.premiumExempt}
                  disabled={!values.manualPremium}
                  onChange={(e) =>
                    setValues({ ...values, premiumExempt: e.target.value })
                  }
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={values.affectedByIva}
                    onCheckedChange={(v) =>
                      setValues({ ...values, affectedByIva: v === true })
                    }
                  />
                  Afecto IVA (19%)
                </label>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={values.sumsToTotal}
                    onCheckedChange={(v) =>
                      setValues({ ...values, sumsToTotal: v === true })
                    }
                  />
                  Suma al total
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label className="text-xs">% Comisión afecta</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={values.commissionAffectPct}
                  onChange={(e) =>
                    setValues({ ...values, commissionAffectPct: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">% Comisión exenta</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={values.commissionExemptPct}
                  onChange={(e) =>
                    setValues({ ...values, commissionExemptPct: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-md bg-card p-2 text-xs sm:grid-cols-4">
              <Stat label="Prima neta" value={calc.premiumNet} />
              <Stat label="IVA" value={calc.ivaAmount} />
              <Stat label="Prima bruta" value={calc.premiumGross} />
              <Stat label="Comisión" value={calc.commissionAmount} />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="tabular-nums font-medium">{fmt(value)}</div>
    </div>
  );
}

function fmt(v: number | null): string {
  if (v === null || v === 0) return "—";
  return v.toLocaleString("es-CL", { maximumFractionDigits: 2 });
}

function fmtPct(v: number | null, decimals = 2): string {
  if (v === null || v === 0) return "—";
  return v.toLocaleString("es-CL", { maximumFractionDigits: decimals });
}

export { fmt as formatCoverageAmount };
