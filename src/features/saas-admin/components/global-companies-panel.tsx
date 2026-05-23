"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createGlobalCompanyAction,
  updateGlobalCompanyAction,
  deleteGlobalCompanyAction,
} from "../actions";
import type { GlobalCompanyRow } from "../queries";
import {
  globalCompanySchema,
  type GlobalCompanyValues,
} from "../schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";

const EMPTY: GlobalCompanyValues = {
  name: "",
  legalName: "",
  rut: "",
  address: "",
  commune: "",
  city: "",
  url: "",
  logoUrl: "",
  isLife: false,
  active: true,
};

export function GlobalCompaniesPanel({ rows }: { rows: GlobalCompanyRow[] }) {
  const [editing, setEditing] = useState<GlobalCompanyRow | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CompanyDialog
          open={open && !editing}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
          trigger={
            <Button onClick={() => setEditing(null)}>
              <Plus className="size-4" /> Nueva compañía global
            </Button>
          }
          initial={EMPTY}
          onSubmit={async (values) => {
            const r = await createGlobalCompanyAction(values);
            if (!r.ok) return r.error;
            toast.success("Compañía creada");
            return null;
          }}
        />
      </div>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Compañía</th>
              <th className="px-3 py-2 text-left">RUT</th>
              <th className="px-3 py-2 text-left">Ubicación</th>
              <th className="px-3 py-2 text-center">Vida</th>
              <th className="px-3 py-2 text-center">Productos</th>
              <th className="px-3 py-2 text-center">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Aún no hay compañías globales.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{r.name}</div>
                        {r.legalName && (
                          <div className="text-xs text-muted-foreground">{r.legalName}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.rut ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[r.commune, r.city].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.isLife ? <Badge variant="secondary">Vida</Badge> : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">{r.productsCount}</td>
                  <td className="px-3 py-2 text-center">
                    {r.active ? (
                      <Badge variant="success">Activa</Badge>
                    ) : (
                      <Badge variant="muted">Inactiva</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <RowActions row={r} />
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

function RowActions({ row }: { row: GlobalCompanyRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  async function handleDelete() {
    if (!confirm(`¿Eliminar/desactivar la compañía "${row.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteGlobalCompanyAction(row.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Compañía eliminada o desactivada");
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <CompanyDialog
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button variant="ghost" size="icon" aria-label="Editar">
            <Pencil className="size-4" />
          </Button>
        }
        initial={{
          name: row.name,
          legalName: row.legalName ?? "",
          rut: row.rut ?? "",
          address: row.address ?? "",
          commune: row.commune ?? "",
          city: row.city ?? "",
          url: row.url ?? "",
          logoUrl: row.logoUrl ?? "",
          isLife: row.isLife,
          active: row.active,
        }}
        onSubmit={async (values) => {
          const r = await updateGlobalCompanyAction(row.id, values);
          if (!r.ok) return r.error;
          toast.success("Compañía actualizada");
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

function CompanyDialog({
  open,
  onOpenChange,
  trigger,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger: React.ReactNode;
  initial: GlobalCompanyValues;
  onSubmit: (values: GlobalCompanyValues) => Promise<string | null>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = globalCompanySchema.safeParse(values);
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compañía global</DialogTitle>
          <DialogDescription>
            Datos predefinidos visibles para todos los tenants. El corredor solo
            ingresa sus propios datos operativos (código corredor, link de
            cobranza, contactos) por encima.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="name">Nombre comercial *</Label>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              required
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="legalName">Razón social</Label>
            <Input
              id="legalName"
              value={values.legalName}
              onChange={(e) => setValues({ ...values, legalName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="rut">RUT</Label>
            <Input
              id="rut"
              value={values.rut}
              onChange={(e) => setValues({ ...values, rut: e.target.value })}
              placeholder="96.519.800-8"
            />
          </div>
          <div>
            <Label htmlFor="url">Sitio web</Label>
            <Input
              id="url"
              value={values.url}
              onChange={(e) => setValues({ ...values, url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="address">Dirección comercial</Label>
            <Input
              id="address"
              value={values.address}
              onChange={(e) => setValues({ ...values, address: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="commune">Comuna</Label>
            <Input
              id="commune"
              value={values.commune}
              onChange={(e) => setValues({ ...values, commune: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="city">Ciudad</Label>
            <Input
              id="city"
              value={values.city}
              onChange={(e) => setValues({ ...values, city: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="logoUrl">URL del logo</Label>
            <Input
              id="logoUrl"
              value={values.logoUrl}
              onChange={(e) => setValues({ ...values, logoUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="col-span-2 flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.isLife}
                onCheckedChange={(v) =>
                  setValues({ ...values, isLife: v === true })
                }
              />
              Compañía de Vida
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.active}
                onCheckedChange={(v) =>
                  setValues({ ...values, active: v === true })
                }
              />
              Activa
            </label>
          </div>
          {error && (
            <div className="col-span-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter className="col-span-2 pt-2">
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
