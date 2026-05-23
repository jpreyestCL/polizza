"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Layers, Pencil, Plus } from "lucide-react";
import {
  createBranchTypeAction,
  updateBranchTypeAction,
} from "../actions";
import type { BranchTypeRow } from "../queries";
import {
  branchTypeSchema,
  type BranchTypeValues,
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

const EMPTY: BranchTypeValues = {
  key: "",
  name: "",
  category: "GENERALES",
  order: "0",
  active: true,
};

const CAT_LABEL: Record<string, string> = {
  GENERALES: "Generales",
  VIDA_SALUD: "Vida y Salud",
};

export function BranchTypesPanel({ rows }: { rows: BranchTypeRow[] }) {
  const [open, setOpen] = useState(false);

  const grouped = rows.reduce<Record<string, BranchTypeRow[]>>((acc, r) => {
    acc[r.category] = acc[r.category] ?? [];
    acc[r.category].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <BranchTypeDialog
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button>
              <Plus className="size-4" /> Nuevo ramo
            </Button>
          }
          initial={EMPTY}
          onSubmit={async (values) => {
            const r = await createBranchTypeAction(values);
            if (!r.ok) return r.error;
            toast.success("Ramo creado");
            return null;
          }}
        />
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {CAT_LABEL[cat] ?? cat}
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((r) => (
              <BranchTypeCard key={r.id} row={r} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BranchTypeCard({ row }: { row: BranchTypeRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{row.name}</div>
            <div className="text-xs text-muted-foreground font-mono">
              {row.key}
            </div>
          </div>
        </div>
        <BranchTypeDialog
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button variant="ghost" size="icon" aria-label="Editar">
              <Pencil className="size-3.5" />
            </Button>
          }
          initial={{
            key: row.key,
            name: row.name,
            category: row.category as "GENERALES" | "VIDA_SALUD",
            order: String(row.order),
            active: row.active,
          }}
          onSubmit={async (values) => {
            const r = await updateBranchTypeAction(row.id, values);
            if (!r.ok) return r.error;
            toast.success("Ramo actualizado");
            return null;
          }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {row.fieldsCount} campos de ficha
        </span>
        {row.active ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="muted">Inactivo</Badge>
        )}
      </div>
      <div className="mt-3">
        <Link
          href={`/admin/ramos/${row.id}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Editar campos de la ficha →
        </Link>
      </div>
    </div>
  );
}

function BranchTypeDialog({
  open,
  onOpenChange,
  trigger,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger: React.ReactNode;
  initial: BranchTypeValues;
  onSubmit: (values: BranchTypeValues) => Promise<string | null>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = branchTypeSchema.safeParse(values);
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
    startTransition(() => router.refresh());
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ramo</DialogTitle>
          <DialogDescription>
            Cada ramo es una categoría de riesgo con su propia ficha de datos
            (Incendio, Vehículos, Casco Marítimo, etc.).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="key">Clave * (minúsculas, guion bajo)</Label>
            <Input
              id="key"
              value={values.key}
              onChange={(e) => setValues({ ...values, key: e.target.value })}
              placeholder="ej: incendio, casco_maritimo"
              required
              className="font-mono"
            />
          </div>
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Categoría *</Label>
            <Select
              value={values.category}
              onValueChange={(v) =>
                setValues({
                  ...values,
                  category: v as "GENERALES" | "VIDA_SALUD",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GENERALES">Generales</SelectItem>
                <SelectItem value="VIDA_SALUD">Vida y Salud</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="order">Orden</Label>
            <Input
              id="order"
              type="number"
              value={values.order}
              onChange={(e) => setValues({ ...values, order: e.target.value })}
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
