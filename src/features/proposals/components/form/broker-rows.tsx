"use client";

import { useState, useTransition } from "react";
import { useFieldArray, type UseFormReturn } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBrokerAction } from "@/features/brokers/actions";
import type { ProposalFormValues } from "../../schemas";

type BrokerOpt = { id: string; name: string; rut: string | null };

export function BrokerRows({
  form,
  brokers: initialBrokers,
}: {
  form: UseFormReturn<ProposalFormValues>;
  brokers: BrokerOpt[];
}) {
  const [brokers, setBrokers] = useState<BrokerOpt[]>(initialBrokers);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [rut, setRut] = useState("");
  const [pending, startTransition] = useTransition();

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "brokerParticipations",
  });

  const rows = form.watch("brokerParticipations") ?? [];
  const total = rows.reduce(
    (s, r) => s + (Number(r.participationPct) || 0),
    0,
  );
  const ok = Math.abs(total - 100) < 0.01;

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    startTransition(async () => {
      const r = await createBrokerAction({
        name: name.trim(),
        rut: rut.trim(),
        email: "",
        phone: "",
        contactName: "",
        address: "",
        isActive: true,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const created: BrokerOpt = { id: r.id, name: name.trim(), rut: rut.trim() || null };
      setBrokers((prev) => [...prev, created]);
      setCreateOpen(false);
      setName("");
      setRut("");
      toast.success("Corredora creada");
    });
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase text-muted-foreground">
          Co-corredores
        </Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-3" /> Nueva corredora
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => append({ brokerId: "", participationPct: "" })}
          >
            <Plus className="size-3" /> Añadir fila
          </Button>
        </div>
      </div>
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aún no hay corredoras participantes.
        </p>
      ) : (
        <div className="space-y-2">
          {fields.map((f, idx) => (
            <div
              key={f.id}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_auto]"
            >
              <Select
                value={
                  form.watch(`brokerParticipations.${idx}.brokerId`) ||
                  undefined
                }
                onValueChange={(v) =>
                  form.setValue(`brokerParticipations.${idx}.brokerId`, v, {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Corredora" />
                </SelectTrigger>
                <SelectContent>
                  {brokers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                      {b.rut ? ` · ${b.rut}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                inputMode="decimal"
                placeholder="% participación"
                value={
                  form.watch(`brokerParticipations.${idx}.participationPct`) ??
                  ""
                }
                onChange={(e) =>
                  form.setValue(
                    `brokerParticipations.${idx}.participationPct`,
                    e.target.value,
                    { shouldDirty: true },
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Eliminar"
                onClick={() => remove(idx)}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          <div
            className={
              "text-right text-xs " +
              (ok ? "text-muted-foreground" : "text-destructive font-medium")
            }
          >
            Total: {total.toFixed(2)}% {ok ? "" : "(debe sumar 100%)"}
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva corredora</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nombre *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">RUT</Label>
              <Input value={rut} onChange={(e) => setRut(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreate} disabled={pending}>
              {pending ? "Creando…" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
