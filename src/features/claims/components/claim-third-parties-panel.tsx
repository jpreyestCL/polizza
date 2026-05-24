"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import type { ClaimThirdParty } from "@prisma/client";
import {
  addClaimThirdPartyAction,
  deleteClaimThirdPartyAction,
} from "../actions";
import type { ClaimThirdPartyValues } from "../schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const blank: ClaimThirdPartyValues = {
  involvesVehicle: true,
  firstName: "",
  lastName: "",
  rut: "",
  phone: "",
  email: "",
  vehicleType: "",
  vehicleBrand: "",
  vehicleModel: "",
  vehicleYear: "",
  plate: "",
  engineNumber: "",
  chassisNumber: "",
  hasInsurance: "",
  insuranceCompany: "",
  policyNumber: "",
  atFault: "",
  damagedGoodsDescription: "",
};

export function ClaimThirdPartiesPanel({
  claimId,
  thirdParties,
}: {
  claimId: string;
  thirdParties: ClaimThirdParty[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Personas, vehículos o bienes de terceros involucrados en el siniestro.
        </p>
        <AddThirdPartyDialog claimId={claimId} />
      </div>

      {thirdParties.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aún no se han registrado terceros.
        </p>
      ) : (
        <ul className="space-y-3">
          {thirdParties.map((tp) => (
            <ThirdPartyCard key={tp.id} claimId={claimId} tp={tp} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ThirdPartyCard({
  claimId,
  tp,
}: {
  claimId: string;
  tp: ClaimThirdParty;
}) {
  const router = useRouter();
  const [deleting, startDeleting] = useTransition();
  const fullName =
    [tp.firstName, tp.lastName].filter(Boolean).join(" ").trim() || "Sin nombre";

  function handleDelete() {
    if (!confirm("¿Eliminar este tercero?")) return;
    startDeleting(async () => {
      const r = await deleteClaimThirdPartyAction(claimId, tp.id);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Tercero eliminado");
        router.refresh();
      }
    });
  }

  return (
    <li className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{fullName}</p>
            {tp.involvesVehicle ? (
              <Badge variant="secondary">Vehículo</Badge>
            ) : (
              <Badge variant="muted">Bien / persona</Badge>
            )}
            {tp.atFault === true && (
              <Badge variant="destructive">Culpable</Badge>
            )}
            {tp.atFault === false && (
              <Badge variant="success">No culpable</Badge>
            )}
          </div>
          {tp.rut && (
            <p className="text-xs text-muted-foreground">RUT: {tp.rut}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Eliminar tercero"
        >
          {deleting ? (
            <Loader2 className="animate-spin text-destructive" />
          ) : (
            <Trash2 className="text-destructive" />
          )}
        </Button>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {tp.phone && <Item label="Teléfono" value={tp.phone} />}
        {tp.email && <Item label="Email" value={tp.email} />}
        {tp.involvesVehicle && (
          <>
            {tp.vehicleType && <Item label="Tipo" value={tp.vehicleType} />}
            {tp.vehicleBrand && <Item label="Marca" value={tp.vehicleBrand} />}
            {tp.vehicleModel && <Item label="Modelo" value={tp.vehicleModel} />}
            {tp.vehicleYear !== null && (
              <Item label="Año" value={String(tp.vehicleYear)} />
            )}
            {tp.plate && <Item label="Patente" value={tp.plate} />}
            {tp.engineNumber && (
              <Item label="N° motor" value={tp.engineNumber} />
            )}
            {tp.chassisNumber && (
              <Item label="N° chasis" value={tp.chassisNumber} />
            )}
          </>
        )}
        {tp.hasInsurance === true && (
          <Item
            label="Seguro"
            value={`${tp.insuranceCompany ?? "Compañía s/d"}${
              tp.policyNumber ? ` · ${tp.policyNumber}` : ""
            }`}
          />
        )}
        {tp.hasInsurance === false && <Item label="Seguro" value="Sin seguro" />}
        {!tp.involvesVehicle && tp.damagedGoodsDescription && (
          <Item
            label="Bien afectado"
            value={tp.damagedGoodsDescription}
            full
          />
        )}
      </dl>
    </li>
  );
}

function Item({
  label,
  value,
  full,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2 lg:col-span-3" : undefined}>
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function AddThirdPartyDialog({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ClaimThirdPartyValues>(blank);
  const [saving, startSaving] = useTransition();

  function set<K extends keyof ClaimThirdPartyValues>(
    key: K,
    val: ClaimThirdPartyValues[K],
  ) {
    setValues((p) => ({ ...p, [key]: val }));
  }

  function submit() {
    startSaving(async () => {
      const r = await addClaimThirdPartyAction(claimId, values);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Tercero agregado");
      setOpen(false);
      setValues(blank);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus /> Agregar tercero
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tercero involucrado</DialogTitle>
          <DialogDescription>
            Datos del tercero. Si no hay vehículo involucrado, desmarca la
            casilla.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-auto pr-1">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={values.involvesVehicle}
              onCheckedChange={(v) => set("involvesVehicle", Boolean(v))}
            />
            Tercero involucrado con un vehículo
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Nombre">
              <Input
                value={values.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </F>
            <F label="Apellido">
              <Input
                value={values.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </F>
            <F label="RUT">
              <Input
                value={values.rut}
                onChange={(e) => set("rut", e.target.value)}
              />
            </F>
            <F label="Teléfono / celular">
              <Input
                value={values.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </F>
            <F label="Email">
              <Input
                type="email"
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </F>
            <TriBool
              label="¿Es culpable?"
              value={values.atFault}
              onChange={(v) => set("atFault", v)}
            />
          </div>

          {values.involvesVehicle ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="Tipo de vehículo">
                <Input
                  value={values.vehicleType}
                  onChange={(e) => set("vehicleType", e.target.value)}
                />
              </F>
              <F label="Marca">
                <Input
                  value={values.vehicleBrand}
                  onChange={(e) => set("vehicleBrand", e.target.value)}
                />
              </F>
              <F label="Modelo">
                <Input
                  value={values.vehicleModel}
                  onChange={(e) => set("vehicleModel", e.target.value)}
                />
              </F>
              <F label="Año">
                <Input
                  type="number"
                  value={values.vehicleYear}
                  onChange={(e) => set("vehicleYear", e.target.value)}
                />
              </F>
              <F label="Patente">
                <Input
                  value={values.plate}
                  onChange={(e) => set("plate", e.target.value)}
                />
              </F>
              <F label="N° motor">
                <Input
                  value={values.engineNumber}
                  onChange={(e) => set("engineNumber", e.target.value)}
                />
              </F>
              <F label="N° chasis">
                <Input
                  value={values.chassisNumber}
                  onChange={(e) => set("chassisNumber", e.target.value)}
                />
              </F>
              <TriBool
                label="¿Tiene seguro?"
                value={values.hasInsurance}
                onChange={(v) => set("hasInsurance", v)}
              />
              <F label="Compañía aseguradora">
                <Input
                  value={values.insuranceCompany}
                  onChange={(e) => set("insuranceCompany", e.target.value)}
                />
              </F>
              <F label="N° de póliza">
                <Input
                  value={values.policyNumber}
                  onChange={(e) => set("policyNumber", e.target.value)}
                />
              </F>
            </div>
          ) : (
            <F label="Descripción del bien afectado">
              <Textarea
                rows={3}
                value={values.damagedGoodsDescription}
                onChange={(e) =>
                  set("damagedGoodsDescription", e.target.value)
                }
              />
            </F>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Plus />}
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function TriBool({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "" | "true" | "false";
  onChange: (v: "" | "true" | "false") => void;
}) {
  return (
    <F label={label}>
      <Select
        value={value || "—"}
        onValueChange={(v) =>
          onChange((v === "—" ? "" : v) as "" | "true" | "false")
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="—">Sin especificar</SelectItem>
          <SelectItem value="true">Sí</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    </F>
  );
}
