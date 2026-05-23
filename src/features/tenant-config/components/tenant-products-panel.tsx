"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Globe, Package, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import {
  adoptGlobalProductAction,
  createCustomProductAction,
  updateTenantProductAction,
  deleteTenantProductAction,
} from "../actions";
import type {
  TenantCompanyRow,
  TenantProductRow,
} from "../queries";
import {
  tenantCustomProductSchema,
  type TenantCustomProductValues,
  tenantProductOverrideSchema,
  type TenantProductOverrideValues,
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

type AvailableGlobalProduct = {
  globalProductId: string;
  productName: string;
  productCode: string | null;
  globalCompanyId: string;
  globalCompanyName: string;
  branchTypeId: string;
  branchTypeName: string;
  tenantCompanyId: string | null;
  tenantCompanyName: string | null;
  commissionAffectPct: number | null;
  commissionExemptPct: number | null;
};

type BranchOption = {
  id: string;
  name: string;
  category: string;
};

export function TenantProductsPanel({
  products,
  available,
  companies,
  branches,
}: {
  products: TenantProductRow[];
  available: AvailableGlobalProduct[];
  companies: TenantCompanyRow[];
  branches: BranchOption[];
}) {
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [filterCompany, setFilterCompany] = useState("ALL");

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          filterCompany === "ALL" || p.insuranceCompanyId === filterCompany,
      ),
    [products, filterCompany],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label className="text-xs">Compañía</Label>
          <Select value={filterCompany} onValueChange={setFilterCompany}>
            <SelectTrigger className="min-w-[220px]">
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
        <div className="flex gap-2">
          <AdoptProductDialog
            open={adoptOpen}
            onOpenChange={setAdoptOpen}
            available={available}
          />
          <CustomProductDialog
            open={customOpen}
            onOpenChange={setCustomOpen}
            trigger={
              <Button variant="outline">
                <Plus className="size-4" /> Producto custom
              </Button>
            }
            initial={{
              insuranceCompanyId: "",
              branchTypeId: "",
              name: "",
              code: "",
              commissionAffectPct: "",
              commissionExemptPct: "",
              active: true,
            }}
            companies={companies}
            branches={branches}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Producto</th>
              <th className="px-3 py-2 text-left">Compañía</th>
              <th className="px-3 py-2 text-left">Ramo</th>
              <th className="px-3 py-2 text-left">Origen</th>
              <th className="px-3 py-2 text-right">% Afecta</th>
              <th className="px-3 py-2 text-right">% Exenta</th>
              <th className="px-3 py-2 text-center">Cobs extra</th>
              <th className="px-3 py-2 text-center">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  Sin productos. Adopta del catálogo o crea uno custom.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <ProductRow key={p.id} product={p} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductRow({ product }: { product: TenantProductRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  async function handleDelete() {
    if (!confirm(`¿Desactivar el producto "${product.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteTenantProductAction(product.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Producto desactivado");
      router.refresh();
    });
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Package className="size-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{product.name}</div>
            {product.code && (
              <div className="text-xs text-muted-foreground font-mono">
                {product.code}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {product.insuranceCompanyName}
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {product.branchTypeName ?? "—"}
      </td>
      <td className="px-3 py-2">
        {product.isCustom ? (
          <Badge variant="outline">Custom</Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <Globe className="size-3" /> Global
          </Badge>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {product.commissionAffectPct !== null
          ? `${product.commissionAffectPct}%`
          : "—"}
        {!product.isCustom &&
          product.globalCommissionAffectPct !== null &&
          product.commissionAffectPct !== product.globalCommissionAffectPct && (
            <div className="text-[10px] text-muted-foreground">
              global: {product.globalCommissionAffectPct}%
            </div>
          )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {product.commissionExemptPct !== null
          ? `${product.commissionExemptPct}%`
          : "—"}
      </td>
      <td className="px-3 py-2 text-center">{product.coveragesCount}</td>
      <td className="px-3 py-2 text-center">
        {product.active ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="muted">Inactivo</Badge>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Coberturas">
            <Link href={`/configuracion/productos/${product.id}/coberturas`}>
              <Receipt className="size-4" />
            </Link>
          </Button>
          <OverrideDialog
            product={product}
            open={open}
            onOpenChange={setOpen}
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
      </td>
    </tr>
  );
}

function OverrideDialog({
  product,
  open,
  onOpenChange,
}: {
  product: TenantProductRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<TenantProductOverrideValues>({
    commissionAffectPct:
      product.commissionAffectPct !== null
        ? String(product.commissionAffectPct)
        : "",
    commissionExemptPct:
      product.commissionExemptPct !== null
        ? String(product.commissionExemptPct)
        : "",
    active: product.active,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = tenantProductOverrideSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const r = await updateTenantProductAction(product.id, parsed.data);
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.success("Producto actualizado");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Editar">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override de {product.name}</DialogTitle>
          <DialogDescription>
            {product.isCustom
              ? "Producto custom: estos % son los que usarás."
              : "Override del % de comisión que pactaste con la compañía."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>% Comisión afecta</Label>
            <Input
              type="number"
              step="0.001"
              value={values.commissionAffectPct}
              onChange={(e) =>
                setValues({ ...values, commissionAffectPct: e.target.value })
              }
            />
            {!product.isCustom &&
              product.globalCommissionAffectPct !== null && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Default global: {product.globalCommissionAffectPct}%
                </div>
              )}
          </div>
          <div>
            <Label>% Comisión exenta</Label>
            <Input
              type="number"
              step="0.001"
              value={values.commissionExemptPct}
              onChange={(e) =>
                setValues({ ...values, commissionExemptPct: e.target.value })
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={values.active}
              onCheckedChange={(v) =>
                setValues({ ...values, active: v === true })
              }
            />
            Activo
          </label>
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

function AdoptProductDialog({
  open,
  onOpenChange,
  available,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  available: AvailableGlobalProduct[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAdopt(id: string, name: string) {
    setLoading(id);
    const r = await adoptGlobalProductAction(id);
    setLoading(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`${name} agregado`);
    onOpenChange(false);
    startTransition(() => router.refresh());
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Globe className="size-4" /> Adoptar del catálogo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Catálogo de productos globales</DialogTitle>
          <DialogDescription>
            Solo se muestran productos de compañías que ya tienes en tu maestro.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-1 overflow-auto pr-1">
          {available.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No hay productos pendientes de adoptar para tus compañías.
            </div>
          ) : (
            available.map((p) => (
              <div
                key={p.globalProductId}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div>
                  <div className="font-medium">{p.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.globalCompanyName} · {p.branchTypeName}
                    {p.commissionAffectPct !== null &&
                      ` · ${p.commissionAffectPct}% afecta`}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading === p.globalProductId}
                  onClick={() => handleAdopt(p.globalProductId, p.productName)}
                >
                  {loading === p.globalProductId ? "Agregando…" : "Adoptar"}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CustomProductDialog({
  open,
  onOpenChange,
  trigger,
  initial,
  companies,
  branches,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger: React.ReactNode;
  initial: TenantCustomProductValues;
  companies: TenantCompanyRow[];
  branches: BranchOption[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = tenantCustomProductSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const r = await createCustomProductAction(parsed.data);
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.success("Producto creado");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Producto custom</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Compañía *</Label>
            <Select
              value={values.insuranceCompanyId}
              onValueChange={(v) =>
                setValues({ ...values, insuranceCompanyId: v })
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
          <div className="col-span-2">
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
            <Label>Nombre *</Label>
            <Input
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Código</Label>
            <Input
              value={values.code}
              onChange={(e) => setValues({ ...values, code: e.target.value })}
            />
          </div>
          <div></div>
          <div>
            <Label>% Comisión afecta</Label>
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
            <Label>% Comisión exenta</Label>
            <Input
              type="number"
              step="0.001"
              value={values.commissionExemptPct}
              onChange={(e) =>
                setValues({ ...values, commissionExemptPct: e.target.value })
              }
            />
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
