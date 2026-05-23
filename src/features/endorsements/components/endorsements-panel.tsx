"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FileSignature, Plus, Trash2 } from "lucide-react";
import {
  createEndorsementAction,
  deleteEndorsementAction,
} from "../actions";
import {
  endorsementSchema,
  ENDORSEMENT_TYPES,
  ENDORSEMENT_TYPE_LABELS,
  type EndorsementValues,
} from "../schemas";
import type { EndorsementRow } from "../queries";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";

const EMPTY: EndorsementValues = {
  type: "MODIFICACION",
  effectiveDate: new Date().toISOString().slice(0, 10),
  reason: "",
  notes: "",
};

const TYPE_VARIANT: Record<string, "default" | "destructive" | "secondary"> = {
  CANCELACION: "destructive",
  ANULACION: "destructive",
  MODIFICACION: "secondary",
};

export function EndorsementsPanel({
  policyId,
  endorsements,
  policyStatus,
}: {
  policyId: string;
  endorsements: EndorsementRow[];
  policyStatus: string;
}) {
  const [open, setOpen] = useState(false);
  const blocked =
    policyStatus === "CANCELADA" || policyStatus === "ANULADA";

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <FileSignature className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Endosos</h2>
        </div>
        <EndorsementDialog
          policyId={policyId}
          open={open}
          onOpenChange={setOpen}
          disabled={blocked}
        />
      </div>
      {endorsements.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Sin endosos. Usa “Nuevo endoso” para registrar cancelaciones,
          anulaciones o modificaciones.
        </div>
      ) : (
        <ul className="divide-y">
          {endorsements.map((e) => (
            <EndorsementItem key={e.id} endorsement={e} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EndorsementItem({ endorsement }: { endorsement: EndorsementRow }) {
  const router = useRouter();
  async function handleDelete() {
    if (
      !confirm(
        `¿Eliminar el endoso de ${ENDORSEMENT_TYPE_LABELS[endorsement.type as keyof typeof ENDORSEMENT_TYPE_LABELS] ?? endorsement.type}? Si era de cancelación/anulación y es el único, la póliza volverá a vigente.`,
      )
    )
      return;
    const r = await deleteEndorsementAction(endorsement.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Endoso eliminado");
    router.refresh();
  }
  return (
    <li className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant={TYPE_VARIANT[endorsement.type] ?? "secondary"}>
            {ENDORSEMENT_TYPE_LABELS[
              endorsement.type as keyof typeof ENDORSEMENT_TYPE_LABELS
            ] ?? endorsement.type}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Fecha efectiva: {endorsement.effectiveDate.toLocaleDateString("es-CL")}
          </span>
        </div>
        {endorsement.reason && (
          <div className="mt-1 text-sm font-medium">{endorsement.reason}</div>
        )}
        {endorsement.notes && (
          <div className="mt-1 text-xs text-muted-foreground">
            {endorsement.notes}
          </div>
        )}
        <div className="mt-1 text-[10px] text-muted-foreground">
          Registrado: {endorsement.createdAt.toLocaleString("es-CL")}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Eliminar"
        onClick={handleDelete}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </li>
  );
}

function EndorsementDialog({
  policyId,
  open,
  onOpenChange,
  disabled,
}: {
  policyId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = endorsementSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const r = await createEndorsementAction(policyId, parsed.data);
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.success("Endoso registrado");
    onOpenChange(false);
    setValues(EMPTY);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Plus className="size-4" /> Nuevo endoso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar endoso</DialogTitle>
          <DialogDescription>
            Cancelación y Anulación cambian el estado de la póliza. Modificación
            solo registra el cambio para la bitácora.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo *</Label>
              <Select
                value={values.type}
                onValueChange={(v) =>
                  setValues({
                    ...values,
                    type: v as (typeof ENDORSEMENT_TYPES)[number],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENDORSEMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ENDORSEMENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fecha efectiva *</Label>
              <Input
                type="date"
                value={values.effectiveDate}
                onChange={(e) =>
                  setValues({ ...values, effectiveDate: e.target.value })
                }
                required
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Motivo</Label>
            <Input
              value={values.reason}
              onChange={(e) =>
                setValues({ ...values, reason: e.target.value })
              }
              placeholder="ej: Solicitud del cliente"
            />
          </div>
          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea
              rows={3}
              value={values.notes}
              onChange={(e) =>
                setValues({ ...values, notes: e.target.value })
              }
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
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
