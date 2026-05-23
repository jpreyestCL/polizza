"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createGlobalProductAction,
  updateGlobalProductAction,
  deleteGlobalProductAction,
} from "../actions";
import type {
  GlobalCompanyRow,
  GlobalProductRow,
  BranchTypeRow,
} from "../queries";
import {
  globalProductSchema,
  type GlobalProductValues,
} from "../schemas";
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

const EMPTY: GlobalProductValues = {
  globalCompanyId: "",
  branchTypeId: "",
  name: "",
  code: "",
  commissionAffectPct: "",
  commissionExemptPct: "",
  active: true,
};

export function GlobalProductsPanel({
  rows,
  companies,
  branches,
}: {
  rows: GlobalProductRow[];
  companies: GlobalCompanyRow[];
  branches: BranchTypeRow[];
}) {
  const [filterCompany, setFilterCompany] = useState<string>("ALL");
  const [filterBranch, setFilterBranch] = useState<string>("ALL");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (filterCompany === "ALL" || r.globalCompanyId === filterCompany) &&
          (filterBranch === "ALL" || r.branchTypeId === filterBranch),
      ),
    [rows, filterCompany, filterBranch],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Compañía</Label>
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="min-w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ramo</Label>
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="min-w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ProductDialog
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button>
              <Plus className="size-4" /> Nuevo producto
            </Button>
          }
          initial={EMPTY}
          companies={companies}
          branches={branches}
          onSubmit={async (values) => {
            const r = await createGlobalProductAction(values);
            if (!r.ok) return r.error;
            toast.success("Producto creado");
            return null;
          }}
        />
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Producto</th>
              <th className="px-3 py-2 text-left">Compañía</th>
              <th className="px-3 py-2 text-left">Ramo</th>
              <th className="px-3 py-2 text-right">% Afecta</th>
              <th className="px-3 py-2 text-right">% Exenta</th>
              <th className="px-3 py-2 text-center">Coberturas</th>
              <th className="px-3 py-2 text-center">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Sin productos.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Package className="size-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          <Link
                            href={`/admin/productos/${r.id}`}
                            className="hover:underline"
                          >
                            {r.name}
                          </Link>
                        </div>
                        {r.code && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {r.code}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.globalCompanyName}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.branchTypeName}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.commissionAffectPct !== null
                      ? `${r.commissionAffectPct}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.commissionExemptPct !== null
                      ? `${r.commissionExemptPct}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">{r.coveragesCount}</td>
                  <td className="px-3 py-2 text-center">
                    {r.active ? (
                      <Badge variant="success">Activo</Badge>
                    ) : (
                      <Badge variant="muted">Inactivo</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ProductRowActions
                      row={r}
                      companies={companies}
                      branches={branches}
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

function ProductRowActions({
  row,
  companies,
  branches,
}: {
  row: GlobalProductRow;
  companies: GlobalCompanyRow[];
  branches: BranchTypeRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  async function handleDelete() {
    if (!confirm(`¿Eliminar/desactivar el producto "${row.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteGlobalProductAction(row.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Producto eliminado o desactivado");
      router.refresh();
    });
  }
  return (
    <div className="flex justify-end gap-1">
      <ProductDialog
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button variant="ghost" size="icon" aria-label="Editar">
            <Pencil className="size-4" />
          </Button>
        }
        initial={{
          globalCompanyId: row.globalCompanyId,
          branchTypeId: row.branchTypeId,
          name: row.name,
          code: row.code ?? "",
          commissionAffectPct:
            row.commissionAffectPct !== null
              ? String(row.commissionAffectPct)
              : "",
          commissionExemptPct:
            row.commissionExemptPct !== null
              ? String(row.commissionExemptPct)
              : "",
          active: row.active,
        }}
        companies={companies}
        branches={branches}
        onSubmit={async (values) => {
          const r = await updateGlobalProductAction(row.id, values);
          if (!r.ok) return r.error;
          toast.success("Producto actualizado");
          return null;
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Eliminar"
        onClick={handleDelete}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}

function ProductDialog({
  open,
  onOpenChange,
  trigger,
  initial,
  companies,
  branches,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger: React.ReactNode;
  initial: GlobalProductValues;
  companies: GlobalCompanyRow[];
  branches: BranchTypeRow[];
  onSubmit: (values: GlobalProductValues) => Promise<string | null>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = globalProductSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const err = await onSubmit(parsed.data);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
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
          <DialogTitle>Producto global</DialogTitle>
          <DialogDescription>
            Producto preconfigurado por compañía y ramo. El % de comisión
            sugerido aplica como default cuando un corredor adopta este producto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div>
            <Label>Compañía *</Label>
            <Select
              value={values.globalCompanyId}
              onValueChange={(v) =>
                setValues({ ...values, globalCompanyId: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona compañía" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ramo *</Label>
            <Select
              value={values.branchTypeId}
              onValueChange={(v) => setValues({ ...values, branchTypeId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona ramo" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="code">Código</Label>
            <Input
              id="code"
              value={values.code}
              onChange={(e) => setValues({ ...values, code: e.target.value })}
              className="font-mono"
            />
          </div>
          <div></div>
          <div>
            <Label htmlFor="commissionAffectPct">% Comisión afecta</Label>
            <Input
              id="commissionAffectPct"
              type="number"
              step="0.001"
              value={values.commissionAffectPct}
              onChange={(e) =>
                setValues({ ...values, commissionAffectPct: e.target.value })
              }
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="commissionExemptPct">% Comisión exenta</Label>
            <Input
              id="commissionExemptPct"
              type="number"
              step="0.001"
              value={values.commissionExemptPct}
              onChange={(e) =>
                setValues({ ...values, commissionExemptPct: e.target.value })
              }
              placeholder="0"
            />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Checkbox
              checked={values.active}
              onCheckedChange={(v) =>
                setValues({ ...values, active: v === true })
              }
            />
            Activo
          </label>
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
