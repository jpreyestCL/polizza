"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { REGIONS } from "@/lib/regions-communes";
import { formatRut, isValidRut } from "@/lib/rut";
import { createClientAction } from "../actions";
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

type ClientType = "PERSONA" | "EMPRESA";

/**
 * Modal con ficha completa de cliente para uso desde el flujo de propuesta
 * (contratante). La carátula de la propuesta + PDF requieren razón social,
 * giro, dirección, comuna, etc., por eso este modal pide todos esos campos
 * (no es el "prospecto" mínimo).
 */
export function FullClientDialog({
  trigger,
  onCreated,
  defaultRut,
  defaultName,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  onCreated: (id: string, name: string, rut: string | null) => void;
  defaultRut?: string;
  defaultName?: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [type, setType] = useState<ClientType>("PERSONA");
  const [rut, setRut] = useState(defaultRut ?? "");
  const [name, setName] = useState(defaultName ?? "");
  const [legalName, setLegalName] = useState("");
  const [giro, setGiro] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [celular, setCelular] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");
  const [commune, setCommune] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincroniza defaults cuando se abre con un query del combobox.
  useEffect(() => {
    if (open) {
      if (defaultRut !== undefined) setRut(defaultRut);
      if (defaultName !== undefined) setName(defaultName);
    }
  }, [open, defaultRut, defaultName]);

  const communes = REGIONS.find((r) => r.name === region)?.communes ?? [];

  function reset() {
    setType("PERSONA");
    setRut("");
    setName("");
    setLegalName("");
    setGiro("");
    setBirthDate("");
    setEmail("");
    setPhone("");
    setCelular("");
    setAddress("");
    setRegion("");
    setCommune("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!rut.trim() || !name.trim()) {
      setError("RUT y nombre son requeridos");
      return;
    }
    if (!isValidRut(rut)) {
      setError("RUT inválido");
      return;
    }
    setSubmitting(true);
    const r = await createClientAction({
      type,
      status: "PROSPECTO",
      rut: formatRut(rut),
      name: name.trim(),
      legalName: legalName.trim(),
      giro: giro.trim(),
      birthDate,
      email: email.trim(),
      phone: phone.trim(),
      celular: celular.trim(),
      address: address.trim(),
      region,
      commune,
      assignedUserId: "",
      vendedor: "",
      cobranzaUserId: "",
      siniestrosUserId: "",
      holdingId: "",
      source: "",
      comentarioAlerta: "",
      observaciones: "",
      contacts: [],
    });
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.success(`Cliente "${name.trim()}" creado`);
    onCreated(r.id, name.trim(), formatRut(rut));
    setOpen(false);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>
            Ficha completa: los datos quedarán disponibles en la propuesta y en
            el PDF. El cliente queda como prospecto y lo puedes activar más
            tarde desde el módulo de Clientes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as ClientType)}
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
                onBlur={() => {
                  if (isValidRut(rut)) setRut(formatRut(rut));
                }}
                placeholder="12.345.678-9"
                required
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">
                {type === "EMPRESA" ? "Nombre comercial *" : "Nombre completo *"}
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {type === "EMPRESA" && (
              <>
                <div>
                  <Label className="text-xs">Razón social</Label>
                  <Input
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Giro</Label>
                  <Input
                    value={giro}
                    onChange={(e) => setGiro(e.target.value)}
                  />
                </div>
              </>
            )}
            {type === "PERSONA" && (
              <div>
                <Label className="text-xs">Fecha de nacimiento</Label>
                <Input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>
            )}
            <div className="col-span-2">
              <Label className="text-xs">Correo</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Celular</Label>
              <Input
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Dirección</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Región</Label>
              <Select
                value={region || undefined}
                onValueChange={(v) => {
                  setRegion(v);
                  setCommune("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar región" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r.code} value={r.name}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Comuna</Label>
              <Select
                value={commune || undefined}
                onValueChange={setCommune}
                disabled={communes.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      communes.length === 0
                        ? "Elige una región primero"
                        : "Seleccionar comuna"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {communes.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
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

export const FullClientDialogTrigger = ({ children }: { children: React.ReactNode }) => (
  <Button type="button" variant="outline" size="icon" aria-label="Nuevo cliente">
    <UserPlus className="size-4" />
    {children}
  </Button>
);
