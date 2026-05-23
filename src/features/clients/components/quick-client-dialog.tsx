"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { createProspectClientAction } from "../actions";
import { Button } from "@/components/ui/button";
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

/**
 * Modal para crear un cliente "prospecto" con datos mínimos (RUT + nombre).
 * Al guardar invoca `onCreated(id, name)` para que el form padre lo seleccione.
 */
export function QuickClientDialog({
  trigger,
  onCreated,
  defaultRut,
  defaultName,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  onCreated: (id: string, name: string) => void;
  defaultRut?: string;
  defaultName?: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [type, setType] = useState<"PERSONA" | "EMPRESA">("PERSONA");
  const [rut, setRut] = useState(defaultRut ?? "");
  const [name, setName] = useState(defaultName ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (defaultRut !== undefined) setRut(defaultRut);
      if (defaultName !== undefined) setName(defaultName);
    }
  }, [open, defaultRut, defaultName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!rut.trim() || !name.trim()) {
      setError("RUT y nombre son requeridos");
      return;
    }
    setSubmitting(true);
    const r = await createProspectClientAction({ rut, name, type });
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.success(`Cliente "${r.name}" creado como prospecto`);
    onCreated(r.id, r.name);
    setOpen(false);
    setRut("");
    setName("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button type="button" variant="outline" size="sm">
              <UserPlus className="size-4" /> Nuevo
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cliente (prospecto)</DialogTitle>
          <DialogDescription>
            Crea un cliente con datos mínimos. Quedará como “Prospecto” y podrás
            completarlo después desde el módulo de Clientes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "PERSONA" | "EMPRESA")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERSONA">Persona</SelectItem>
                  <SelectItem value="EMPRESA">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">RUT *</Label>
              <Input
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                placeholder="12.345.678-9"
                required
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">
              {type === "EMPRESA" ? "Razón social *" : "Nombre completo *"}
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
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
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creando…" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
