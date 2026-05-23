"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createBrokerAction,
  updateBrokerAction,
  deleteBrokerAction,
} from "../actions";
import type { BrokerListItem } from "../queries";
import { brokerFormSchema, type BrokerFormValues } from "../schemas";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const EMPTY: BrokerFormValues = {
  name: "",
  rut: "",
  email: "",
  phone: "",
  contactName: "",
  address: "",
  isActive: true,
};

export function BrokersPanel({ rows }: { rows: BrokerListItem[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BrokerListItem | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: BrokerListItem) {
    setEditing(row);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Nueva corredora
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>RUT</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Aún no has registrado corredoras.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.rut ?? "—"}</TableCell>
                  <TableCell>{row.contactName ?? "—"}</TableCell>
                  <TableCell>{row.email ?? "—"}</TableCell>
                  <TableCell>{row.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? "default" : "secondary"}>
                      {row.isActive ? "Activa" : "Inactiva"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions row={row} onEdit={() => openEdit(row)} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <BrokerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
      />
    </div>
  );
}

function RowActions({
  row,
  onEdit,
}: {
  row: BrokerListItem;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function onDelete() {
    if (!confirm(`Eliminar corredora "${row.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteBrokerAction(row.id);
      if (res.ok) {
        toast.success("Corredora eliminada");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" disabled={pending} onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function BrokerDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: BrokerListItem | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<BrokerFormValues>(
    initial
      ? {
          name: initial.name,
          rut: initial.rut ?? "",
          email: initial.email ?? "",
          phone: initial.phone ?? "",
          contactName: initial.contactName ?? "",
          address: initial.address ?? "",
          isActive: initial.isActive,
        }
      : EMPTY,
  );

  // Re-sync when `initial` cambia entre aperturas.
  useStateInitial(initial, setValues);

  function update<K extends keyof BrokerFormValues>(
    key: K,
    value: BrokerFormValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = brokerFormSchema.safeParse(values);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
      toast.error(first);
      return;
    }
    startTransition(async () => {
      const res = initial
        ? await updateBrokerAction(initial.id, parsed.data)
        : await createBrokerAction(parsed.data);
      if (res.ok) {
        toast.success(initial ? "Corredora actualizada" : "Corredora creada");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Editar corredora" : "Nueva corredora"}
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={onSubmit}>
          <Field label="Nombre" required>
            <Input
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="RUT">
              <Input
                value={values.rut}
                onChange={(e) => update("rut", e.target.value)}
              />
            </Field>
            <Field label="Contacto">
              <Input
                value={values.contactName}
                onChange={(e) => update("contactName", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input
                type="email"
                value={values.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </Field>
            <Field label="Teléfono">
              <Input
                value={values.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Dirección">
            <Input
              value={values.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={values.isActive}
              onCheckedChange={(v) => update("isActive", Boolean(v))}
            />
            Activa
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label>
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

// Sincroniza el estado interno del diálogo con `initial` cuando éste cambia.
import { useEffect } from "react";
function useStateInitial(
  initial: BrokerListItem | null,
  setValues: (v: BrokerFormValues) => void,
) {
  useEffect(() => {
    setValues(
      initial
        ? {
            name: initial.name,
            rut: initial.rut ?? "",
            email: initial.email ?? "",
            phone: initial.phone ?? "",
            contactName: initial.contactName ?? "",
            address: initial.address ?? "",
            isActive: initial.isActive,
          }
        : EMPTY,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);
}
