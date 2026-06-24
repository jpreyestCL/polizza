"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Save, Trash2 } from "lucide-react";
import {
  upsertItemCoverageAction,
  deleteItemCoverageAction,
  copyProductCoveragesAction,
  saveItemCoveragesAction,
} from "../actions";
import {
  itemCoverageSchema,
  computeCoverage,
  type ItemCoverageValues,
  type ItemCoverageRowValues,
} from "../schemas";
import type { ItemCoverageRow } from "../queries";
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

/** Fila editable del grid (valores + id de la cobertura si ya existe). */
type EditRow = ItemCoverageRowValues;

function rowFromCoverage(c: ItemCoverageRow): EditRow {
  return {
    id: c.id,
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

function blankRow(
  defaults: { commissionAffectPct?: string; commissionExemptPct?: string } = {},
): EditRow {
  return {
    ...EMPTY,
    id: "",
    commissionAffectPct: defaults.commissionAffectPct ?? "",
    commissionExemptPct: defaults.commissionExemptPct ?? "",
  };
}

export function ItemCoveragesDialog({
  itemId,
  itemLabel,
  coverages,
  productId,
  trigger,
  defaultCommissionAffectPct,
  defaultCommissionExemptPct,
  open: openProp,
  onOpenChange,
}: {
  itemId: string;
  itemLabel: string;
  coverages: ItemCoverageRow[];
  productId: string | null;
  trigger: React.ReactNode;
  defaultCommissionAffectPct?: number | null;
  defaultCommissionExemptPct?: number | null;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };
  const [editing, setEditing] = useState<ItemCoverageRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const defaultComm = {
    commissionAffectPct:
      defaultCommissionAffectPct != null
        ? String(defaultCommissionAffectPct)
        : "",
    commissionExemptPct:
      defaultCommissionExemptPct != null
        ? String(defaultCommissionExemptPct)
        : "",
  };

  // Grid editable. Se re-sincroniza cuando cambian las coberturas del servidor
  // (tras copiar del producto, editar en el modal, etc.).
  const [rows, setRows] = useState<EditRow[]>(() =>
    coverages.map(rowFromCoverage),
  );
  const serverSig = coverages
    .map(
      (c) =>
        `${c.id}:${c.name}:${c.insuredAmount}:${c.taxRateAffect}:${c.taxRateExempt}:${c.premiumNet}:${c.commissionAmount}`,
    )
    .join("|");
  useEffect(() => {
    setRows(coverages.map(rowFromCoverage));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSig]);

  function patchRow(idx: number, patch: Partial<EditRow>) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow(defaultComm)]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    // Descarta filas totalmente vacías (sin nombre).
    const clean = rows.filter((r) => r.name.trim() !== "");
    for (const r of clean) {
      const parsed = itemCoverageSchema.safeParse(r);
      if (!parsed.success) {
        toast.error(
          `Revisa la cobertura "${r.name || "(sin nombre)"}": ${
            parsed.error.issues[0]?.message ?? "datos inválidos"
          }`,
        );
        return;
      }
    }
    setSaving(true);
    const res = await saveItemCoveragesAction(itemId, { rows: clean });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Coberturas guardadas");
    router.refresh();
  }

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

  // Totales en vivo desde el grid. Las primas (afecta + exenta) SIEMPRE se
  // suman; la casilla "Suma" solo controla el monto asegurado (ver obs).
  const totals = rows.reduce(
    (acc, r) => {
      const c = computeCoverage(r);
      acc.net += c.premiumNet;
      acc.iva += c.ivaAmount;
      acc.gross += c.premiumGross;
      acc.commission += c.commissionAmount;
      return acc;
    },
    { net: 0, iva: 0, gross: 0, commission: 0 },
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-w-[95vw] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Coberturas · {itemLabel}</DialogTitle>
            <DialogDescription>
              Edita el monto asegurado y las tasas directamente en la tabla.
              Prima afecta = (tasa afecta × monto) / 1000; exenta = (tasa exenta
              × monto) / 1000. IVA = afecta × 19% (si aplica).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyFromProduct}
              disabled={!productId}
            >
              <Copy className="size-4" /> Copiar del producto
            </Button>
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="size-4" /> Agregar cobertura
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[1100px] text-xs">
              <thead className="border-b bg-muted/40 uppercase text-muted-foreground">
                <tr>
                  <th className="px-1.5 py-1.5 text-left">Tipo</th>
                  <th className="px-1.5 py-1.5 text-left">Cobertura</th>
                  <th className="px-1.5 py-1.5 text-center">Val.</th>
                  <th className="px-1.5 py-1.5 text-right">Mto. aseg.</th>
                  <th
                    className="px-1.5 py-1.5 text-center"
                    title="Suma el monto asegurado de esta cobertura al monto asegurado total. Las primas siempre se suman."
                  >
                    Suma M.A.
                  </th>
                  <th className="px-1.5 py-1.5 text-center">IVA</th>
                  <th className="px-1.5 py-1.5 text-right">T. afe ‰</th>
                  <th className="px-1.5 py-1.5 text-right">T. exe ‰</th>
                  <th className="px-1.5 py-1.5 text-right">P. afe</th>
                  <th className="px-1.5 py-1.5 text-right">P. exe</th>
                  <th className="px-1.5 py-1.5 text-right">Neta</th>
                  <th className="px-1.5 py-1.5 text-right">IVA $</th>
                  <th className="px-1.5 py-1.5 text-right">Bruta</th>
                  <th className="px-1.5 py-1.5 text-right">% c.afe</th>
                  <th className="px-1.5 py-1.5 text-right">% c.exe</th>
                  <th className="px-1.5 py-1.5 text-right">Comisión</th>
                  <th className="px-1.5 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={17}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      Sin coberturas. Copia las del producto o agrega filas.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => {
                    const calc = computeCoverage(row);
                    return (
                      <tr key={row.id || `new-${idx}`} className="border-b last:border-0">
                        <td className="px-1 py-1">
                          <Select
                            value={row.type}
                            onValueChange={(v) =>
                              patchRow(idx, {
                                type: v as "COBERTURA" | "ADICIONAL",
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-[72px] px-1.5 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="COBERTURA">Cob</SelectItem>
                              <SelectItem value="ADICIONAL">Adi</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={row.name}
                            onChange={(e) =>
                              patchRow(idx, { name: e.target.value })
                            }
                            placeholder="Cobertura"
                            className="h-8 min-w-[150px] text-xs"
                          />
                          {row.polCad && (
                            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                              {row.polCad}
                            </div>
                          )}
                        </td>
                        <td className="px-1 py-1 text-center">
                          <Checkbox
                            checked={row.isCommercialValue}
                            onCheckedChange={(v) => {
                              const com = v === true;
                              patchRow(idx, {
                                isCommercialValue: com,
                                insuredAmount: com ? "0" : row.insuredAmount,
                              });
                            }}
                          />
                        </td>
                        <td className="px-1 py-1">
                          {row.isCommercialValue ? (
                            <span className="block text-right text-[11px] text-muted-foreground">
                              Valor comercial
                            </span>
                          ) : (
                            <Input
                              type="number"
                              step="0.01"
                              value={row.insuredAmount}
                              onChange={(e) =>
                                patchRow(idx, { insuredAmount: e.target.value })
                              }
                              className="h-8 w-[110px] text-right text-xs tabular-nums"
                            />
                          )}
                        </td>
                        <td className="px-1 py-1 text-center">
                          <Checkbox
                            checked={row.sumsToTotal}
                            onCheckedChange={(v) =>
                              patchRow(idx, { sumsToTotal: v === true })
                            }
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <Checkbox
                            checked={row.affectedByIva}
                            onCheckedChange={(v) =>
                              patchRow(idx, { affectedByIva: v === true })
                            }
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            step="0.0001"
                            value={row.taxRateAffect}
                            disabled={row.manualPremium}
                            onChange={(e) =>
                              patchRow(idx, { taxRateAffect: e.target.value })
                            }
                            className="h-8 w-[72px] text-right text-xs tabular-nums"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            step="0.0001"
                            value={row.taxRateExempt}
                            disabled={row.manualPremium}
                            onChange={(e) =>
                              patchRow(idx, { taxRateExempt: e.target.value })
                            }
                            className="h-8 w-[72px] text-right text-xs tabular-nums"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={
                              affectIsManual(row)
                                ? row.premiumAffect
                                : fmtNum(premiumAffectOf(row))
                            }
                            disabled={!affectIsManual(row)}
                            onChange={(e) =>
                              patchRow(idx, { premiumAffect: e.target.value })
                            }
                            className="h-8 w-[90px] text-right text-xs tabular-nums"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={
                              exemptIsManual(row)
                                ? row.premiumExempt
                                : fmtNum(premiumExemptOf(row))
                            }
                            disabled={!exemptIsManual(row)}
                            onChange={(e) =>
                              patchRow(idx, { premiumExempt: e.target.value })
                            }
                            className="h-8 w-[90px] text-right text-xs tabular-nums"
                          />
                        </td>
                        <td className="px-1.5 py-1 text-right tabular-nums font-medium">
                          {fmt(calc.premiumNet)}
                        </td>
                        <td className="px-1.5 py-1 text-right tabular-nums">
                          {fmt(calc.ivaAmount)}
                        </td>
                        <td className="px-1.5 py-1 text-right tabular-nums font-medium">
                          {fmt(calc.premiumGross)}
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            step="0.001"
                            value={row.commissionAffectPct}
                            onChange={(e) =>
                              patchRow(idx, {
                                commissionAffectPct: e.target.value,
                              })
                            }
                            className="h-8 w-[64px] text-right text-xs tabular-nums"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            step="0.001"
                            value={row.commissionExemptPct}
                            onChange={(e) =>
                              patchRow(idx, {
                                commissionExemptPct: e.target.value,
                              })
                            }
                            className="h-8 w-[64px] text-right text-xs tabular-nums"
                          />
                        </td>
                        <td className="px-1.5 py-1 text-right tabular-nums">
                          {fmt(calc.commissionAmount)}
                        </td>
                        <td className="px-1 py-1">
                          <div className="flex justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Edición avanzada"
                              title="Edición avanzada (POL/CAD, manual…)"
                              className="size-7"
                              onClick={() => {
                                if (row.id) {
                                  const src = coverages.find(
                                    (c) => c.id === row.id,
                                  );
                                  if (src) {
                                    setEditing(src);
                                    setFormOpen(true);
                                    return;
                                  }
                                }
                                // Fila nueva sin guardar: alterna manual inline.
                                patchRow(idx, {
                                  manualPremium: !row.manualPremium,
                                });
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Eliminar"
                              className="size-7"
                              onClick={() =>
                                row.id ? handleDelete(row.id) : removeRow(idx)
                              }
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="border-t bg-muted/30">
                  <tr>
                    <td colSpan={10} className="px-2 py-1.5 text-right font-medium">
                      Totales:
                    </td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold">
                      {fmt(totals.net)}
                    </td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums">
                      {fmt(totals.iva)}
                    </td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold">
                      {fmt(totals.gross)}
                    </td>
                    <td colSpan={2}></td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums font-medium">
                      {fmt(totals.commission)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="size-4" />
              {saving ? "Grabando…" : "Grabar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CoverageFormDialog
        itemId={itemId}
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing ? rowToValues(editing) : { ...EMPTY, ...defaultComm }}
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
            <div className="flex flex-col gap-2 pb-1 sm:items-start sm:justify-end">
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={values.isCommercialValue}
                  onCheckedChange={(v) => {
                    const isCommercial = v === true;
                    setValues({
                      ...values,
                      isCommercialValue: isCommercial,
                      insuredAmount: isCommercial ? "0" : values.insuredAmount,
                    });
                  }}
                />
                Valor comercial
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={values.sumsToTotal}
                  onCheckedChange={(v) =>
                    setValues({ ...values, sumsToTotal: v === true })
                  }
                />
                Suma monto asegurado al total
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
                  onCheckedChange={(v) => {
                    const isManual = v === true;
                    setValues({
                      ...values,
                      manualPremium: isManual,
                      taxRateAffect: isManual ? "" : values.taxRateAffect,
                      taxRateExempt: isManual ? "" : values.taxRateExempt,
                    });
                  }}
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
                  disabled={
                    !values.manualPremium && Number(values.taxRateAffect) > 0
                  }
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
                  disabled={
                    !values.manualPremium && Number(values.taxRateExempt) > 0
                  }
                  onChange={(e) =>
                    setValues({ ...values, premiumExempt: e.target.value })
                  }
                />
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

/**
 * La prima afecta es editable cuando se marcó "cálculo manual" (obs 6) o
 * cuando no se ingresó tasa afecta (obs 5: si no hay tasa se ingresa a mano).
 */
function affectIsManual(row: ItemCoverageRowValues): boolean {
  return row.manualPremium || !(Number(row.taxRateAffect) > 0);
}

function exemptIsManual(row: ItemCoverageRowValues): boolean {
  return row.manualPremium || !(Number(row.taxRateExempt) > 0);
}

/** Prima afecta calculada de una fila (para mostrar cuando se deriva de la tasa). */
function premiumAffectOf(row: ItemCoverageRowValues): number {
  if (affectIsManual(row)) return Number(row.premiumAffect) || 0;
  const insured = Number(row.insuredAmount) || 0;
  return (insured * (Number(row.taxRateAffect) || 0)) / 1000;
}

function premiumExemptOf(row: ItemCoverageRowValues): number {
  if (exemptIsManual(row)) return Number(row.premiumExempt) || 0;
  const insured = Number(row.insuredAmount) || 0;
  return (insured * (Number(row.taxRateExempt) || 0)) / 1000;
}

function fmt(v: number | null): string {
  if (v === null || v === 0) return "—";
  return v.toLocaleString("es-CL", { maximumFractionDigits: 2 });
}

function fmtNum(v: number): string {
  if (!v) return "";
  return String(Math.round(v * 100) / 100);
}

export { fmt as formatCoverageAmount };
