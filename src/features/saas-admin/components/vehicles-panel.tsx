"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createVehicleBrandAction,
  updateVehicleBrandAction,
  deleteVehicleBrandAction,
  createVehicleModelAction,
  updateVehicleModelAction,
  deleteVehicleModelAction,
  createVehicleTypeAction,
  updateVehicleTypeAction,
  deleteVehicleTypeAction,
} from "../actions";
import type {
  VehicleBrandRow,
  VehicleModelRow,
  VehicleTypeRow,
} from "../queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function VehiclesPanel({
  brands,
  models,
  types,
}: {
  brands: VehicleBrandRow[];
  models: VehicleModelRow[];
  types: VehicleTypeRow[];
}) {
  return (
    <Tabs defaultValue="marcas">
      <TabsList>
        <TabsTrigger value="marcas">Marcas ({brands.length})</TabsTrigger>
        <TabsTrigger value="modelos">Modelos ({models.length})</TabsTrigger>
        <TabsTrigger value="tipos">Tipos ({types.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="marcas" className="space-y-4 pt-4">
        <BrandsPanel rows={brands} />
      </TabsContent>
      <TabsContent value="modelos" className="space-y-4 pt-4">
        <ModelsPanel rows={models} brands={brands} />
      </TabsContent>
      <TabsContent value="tipos" className="space-y-4 pt-4">
        <TypesPanel rows={types} />
      </TabsContent>
    </Tabs>
  );
}

// ─── Marcas ────────────────────────────────────────────────────────

function BrandsPanel({ rows }: { rows: VehicleBrandRow[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <BrandDialog
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button>
              <Plus className="size-4" /> Nueva marca
            </Button>
          }
          initial={{ name: "", active: true }}
          onSubmit={async (v) => {
            const r = await createVehicleBrandAction(v);
            if (!r.ok) return r.error;
            toast.success("Marca creada");
            return null;
          }}
        />
      </div>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Marca</th>
              <th className="px-3 py-2 text-center">Modelos</th>
              <th className="px-3 py-2 text-center">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No hay marcas.
                </td>
              </tr>
            ) : (
              rows.map((r) => <BrandRow key={r.id} row={r} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BrandRow({ row }: { row: VehicleBrandRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  async function handleDelete() {
    if (!confirm(`¿Eliminar la marca "${row.name}"? (también borra sus modelos)`)) return;
    startTransition(async () => {
      const r = await deleteVehicleBrandAction(row.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Marca eliminada");
      router.refresh();
    });
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2 font-medium">{row.name}</td>
      <td className="px-3 py-2 text-center">{row.modelsCount}</td>
      <td className="px-3 py-2 text-center">
        {row.active ? (
          <Badge variant="success">Activa</Badge>
        ) : (
          <Badge variant="muted">Inactiva</Badge>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <BrandDialog
            open={open}
            onOpenChange={setOpen}
            trigger={
              <Button variant="ghost" size="icon" aria-label="Editar">
                <Pencil className="size-4" />
              </Button>
            }
            initial={{ name: row.name, active: row.active }}
            onSubmit={async (v) => {
              const r = await updateVehicleBrandAction(row.id, v);
              if (!r.ok) return r.error;
              toast.success("Marca actualizada");
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
      </td>
    </tr>
  );
}

function BrandDialog({
  open,
  onOpenChange,
  trigger,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger: React.ReactNode;
  initial: { name: string; active: boolean };
  onSubmit: (v: { name: string; active: boolean }) => Promise<string | null>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const err = await onSubmit(values);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    onOpenChange(false);
    setValues(initial);
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
          <DialogTitle>Marca de vehículo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Nombre *</Label>
            <Input
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={values.active}
              onCheckedChange={(v) =>
                setValues({ ...values, active: v === true })
              }
            />
            Activa
          </label>
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
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

// ─── Modelos ───────────────────────────────────────────────────────

function ModelsPanel({
  rows,
  brands,
}: {
  rows: VehicleModelRow[];
  brands: VehicleBrandRow[];
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const filtered = filter
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(filter.toLowerCase()) ||
          r.brandName.toLowerCase().includes(filter.toLowerCase()),
      )
    : rows;

  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-2">
        <Input
          placeholder="Filtrar por marca o modelo"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <ModelDialog
          open={open}
          onOpenChange={setOpen}
          brands={brands}
          trigger={
            <Button>
              <Plus className="size-4" /> Nuevo modelo
            </Button>
          }
          initial={{ brandId: brands[0]?.id ?? "", name: "", active: true }}
          onSubmit={async (v) => {
            const r = await createVehicleModelAction(v);
            if (!r.ok) return r.error;
            toast.success("Modelo creado");
            return null;
          }}
        />
      </div>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Marca</th>
              <th className="px-3 py-2 text-left">Modelo</th>
              <th className="px-3 py-2 text-center">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No hay modelos.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <ModelRow key={r.id} row={r} brands={brands} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModelRow({
  row,
  brands,
}: {
  row: VehicleModelRow;
  brands: VehicleBrandRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  async function handleDelete() {
    if (!confirm(`¿Eliminar el modelo "${row.brandName} ${row.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteVehicleModelAction(row.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Modelo eliminado");
      router.refresh();
    });
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2 text-muted-foreground">{row.brandName}</td>
      <td className="px-3 py-2 font-medium">{row.name}</td>
      <td className="px-3 py-2 text-center">
        {row.active ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="muted">Inactivo</Badge>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <ModelDialog
            open={open}
            onOpenChange={setOpen}
            brands={brands}
            trigger={
              <Button variant="ghost" size="icon" aria-label="Editar">
                <Pencil className="size-4" />
              </Button>
            }
            initial={{ brandId: row.brandId, name: row.name, active: row.active }}
            onSubmit={async (v) => {
              const r = await updateVehicleModelAction(row.id, v);
              if (!r.ok) return r.error;
              toast.success("Modelo actualizado");
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
      </td>
    </tr>
  );
}

function ModelDialog({
  open,
  onOpenChange,
  trigger,
  initial,
  brands,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger: React.ReactNode;
  brands: VehicleBrandRow[];
  initial: { brandId: string; name: string; active: boolean };
  onSubmit: (v: { brandId: string; name: string; active: boolean }) => Promise<string | null>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.brandId) {
      setError("Selecciona una marca");
      return;
    }
    setSubmitting(true);
    const err = await onSubmit(values);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    onOpenChange(false);
    setValues(initial);
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
          <DialogTitle>Modelo de vehículo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Marca *</Label>
            <Select
              value={values.brandId || undefined}
              onValueChange={(v) => setValues({ ...values, brandId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona marca" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nombre del modelo *</Label>
            <Input
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              required
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
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
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

// ─── Tipos ─────────────────────────────────────────────────────────

function TypesPanel({ rows }: { rows: VehicleTypeRow[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <TypeDialog
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button>
              <Plus className="size-4" /> Nuevo tipo
            </Button>
          }
          initial={{ name: "", active: true }}
          onSubmit={async (v) => {
            const r = await createVehicleTypeAction(v);
            if (!r.ok) return r.error;
            toast.success("Tipo creado");
            return null;
          }}
        />
      </div>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-center">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                  No hay tipos.
                </td>
              </tr>
            ) : (
              rows.map((r) => <TypeRow key={r.id} row={r} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TypeRow({ row }: { row: VehicleTypeRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  async function handleDelete() {
    if (!confirm(`¿Eliminar el tipo "${row.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteVehicleTypeAction(row.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Tipo eliminado");
      router.refresh();
    });
  }
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2 font-medium">{row.name}</td>
      <td className="px-3 py-2 text-center">
        {row.active ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="muted">Inactivo</Badge>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <TypeDialog
            open={open}
            onOpenChange={setOpen}
            trigger={
              <Button variant="ghost" size="icon" aria-label="Editar">
                <Pencil className="size-4" />
              </Button>
            }
            initial={{ name: row.name, active: row.active }}
            onSubmit={async (v) => {
              const r = await updateVehicleTypeAction(row.id, v);
              if (!r.ok) return r.error;
              toast.success("Tipo actualizado");
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
      </td>
    </tr>
  );
}

function TypeDialog({
  open,
  onOpenChange,
  trigger,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger: React.ReactNode;
  initial: { name: string; active: boolean };
  onSubmit: (v: { name: string; active: boolean }) => Promise<string | null>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const err = await onSubmit(values);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    onOpenChange(false);
    setValues(initial);
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
          <DialogTitle>Tipo de vehículo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Nombre *</Label>
            <Input
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              required
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
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
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
