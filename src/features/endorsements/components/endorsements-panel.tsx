"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FileSignature, Plus, Trash2 } from "lucide-react";
import {
  createEndorsementAction,
  deleteEndorsementAction,
} from "../actions";
import {
  COMPANY_INITIATED_TYPES,
  endorsementSchema,
  ENDORSEMENT_TYPES,
  ENDORSEMENT_TYPE_LABELS,
  endorsementStatusEffect,
  type EndorsementMode,
  type EndorsementTypeValue,
  type EndorsementValues,
} from "../schemas";
import type { EndorsementProposalRow, EndorsementRow } from "../queries";
import { ProposalStatusBadge } from "@/features/proposals/components/proposal-badges";
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

function typeLabel(type: string | null): string {
  if (!type) return "Endoso";
  return ENDORSEMENT_TYPE_LABELS[type as EndorsementTypeValue] ?? type;
}

function defaultModeFor(type: EndorsementTypeValue): EndorsementMode {
  return COMPANY_INITIATED_TYPES.includes(type) ? "DIRECTO" : "PROPUESTA";
}

export function EndorsementsPanel({
  policyId,
  endorsements,
  endorsementProposals,
  policyStatus,
  policyEndDate,
}: {
  policyId: string;
  endorsements: EndorsementRow[];
  endorsementProposals: EndorsementProposalRow[];
  policyStatus: string;
  policyEndDate: string;
}) {
  const [open, setOpen] = useState(false);
  const blocked =
    policyStatus === "CANCELADA" || policyStatus === "ANULADA";
  const empty =
    endorsements.length === 0 && endorsementProposals.length === 0;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <FileSignature className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Endosos</h2>
        </div>
        <EndorsementDialog
          policyId={policyId}
          policyEndDate={policyEndDate}
          open={open}
          onOpenChange={setOpen}
          disabled={blocked}
        />
      </div>
      {empty ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Sin endosos. Usa “Nuevo endoso” para generar la propuesta de endoso a
          la compañía o registrar un endoso ya emitido.
        </div>
      ) : (
        <>
          {endorsementProposals.length > 0 ? (
            <div className="border-b">
              <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Propuestas de endoso en proceso
              </p>
              <ul className="divide-y">
                {endorsementProposals.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/propuestas/${p.id}`}
                          className="font-medium hover:text-primary"
                        >
                          Propuesta N° {p.proposalNumber}
                        </Link>
                        <ProposalStatusBadge status={p.status} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {typeLabel(p.endorsementType)}
                        {p.startDate
                          ? ` · desde ${p.startDate.toLocaleDateString("es-CL")}`
                          : ""}
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/propuestas/${p.id}`}>Abrir</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {endorsements.length > 0 ? (
            <ul className="divide-y">
              {endorsements.map((e) => (
                <EndorsementItem key={e.id} endorsement={e} />
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}

function EndorsementItem({ endorsement }: { endorsement: EndorsementRow }) {
  const router = useRouter();
  const movesStatus = Boolean(
    endorsementStatusEffect(endorsement.type as EndorsementTypeValue),
  );
  async function handleDelete() {
    if (
      !confirm(
        `¿Eliminar el endoso de ${typeLabel(endorsement.type)}? Si cambiaba el estado de la póliza y es el único de su tipo, la póliza volverá a vigente.${
          endorsement.proposal
            ? " La propuesta de endoso volverá a quedar por despachar."
            : ""
        }`,
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
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={movesStatus ? "destructive" : "secondary"}>
            {typeLabel(endorsement.type)}
          </Badge>
          {endorsement.endorsementNumber ? (
            <span className="text-sm font-medium">
              N° {endorsement.endorsementNumber}
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground">
            Desde {endorsement.effectiveDate.toLocaleDateString("es-CL")}
            {endorsement.endDate
              ? ` hasta ${endorsement.endDate.toLocaleDateString("es-CL")}`
              : ""}
          </span>
        </div>
        {endorsement.detail && (
          <div className="mt-1 whitespace-pre-line text-sm">
            {endorsement.detail}
          </div>
        )}
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
          {endorsement.proposal ? (
            <>
              {" · "}
              <Link
                href={`/propuestas/${endorsement.proposal.id}`}
                className="hover:text-primary hover:underline"
              >
                Propuesta N° {endorsement.proposal.proposalNumber}
              </Link>
            </>
          ) : null}
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

function emptyValues(policyEndDate: string): EndorsementValues {
  return {
    mode: "PROPUESTA",
    type: "MODIFICACION",
    effectiveDate: new Date().toISOString().slice(0, 10),
    endDate: policyEndDate,
    detail: "",
    endorsementNumber: "",
    notes: "",
  };
}

function EndorsementDialog({
  policyId,
  policyEndDate,
  open,
  onOpenChange,
  disabled,
}: {
  policyId: string;
  policyEndDate: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(() => emptyValues(policyEndDate));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isProposal = values.mode === "PROPUESTA";

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
    onOpenChange(false);
    setValues(emptyValues(policyEndDate));
    if (r.data?.proposalId) {
      toast.success("Propuesta de endoso creada");
      router.push(`/propuestas/${r.data.proposalId}`);
      return;
    }
    toast.success("Endoso registrado");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Plus className="size-4" /> Nuevo endoso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo endoso</DialogTitle>
          <DialogDescription>
            La propuesta de endoso sigue el mismo proceso que una propuesta de
            póliza: se genera el PDF, se envía a la compañía y, cuando la
            compañía emite el endoso y lo revisas, se registra en la póliza y
            se despacha al cliente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-md border p-1 text-sm">
            {(
              [
                ["PROPUESTA", "Propuesta de endoso a la compañía"],
                ["DIRECTO", "Registrar endoso ya emitido"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setValues({ ...values, mode })}
                className={`rounded px-3 py-1.5 ${
                  values.mode === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div>
            <Label className="text-xs">Tipo *</Label>
            <Select
              value={values.type}
              onValueChange={(v) => {
                const type = v as EndorsementTypeValue;
                setValues({ ...values, type, mode: defaultModeFor(type) });
              }}
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
            {endorsementStatusEffect(values.type) ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Deja la póliza{" "}
                {endorsementStatusEffect(values.type) === "CANCELADA"
                  ? "cancelada"
                  : "anulada"}{" "}
                {isProposal
                  ? "cuando se despache el endoso emitido."
                  : "al registrarlo."}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Inicio endoso *</Label>
              <Input
                type="date"
                value={values.effectiveDate}
                onChange={(e) =>
                  setValues({ ...values, effectiveDate: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label className="text-xs">Fin endoso</Label>
              <Input
                type="date"
                value={values.endDate}
                onChange={(e) =>
                  setValues({ ...values, endDate: e.target.value })
                }
              />
            </div>
          </div>
          {!isProposal ? (
            <div>
              <Label className="text-xs">N° de endoso (compañía)</Label>
              <Input
                value={values.endorsementNumber}
                onChange={(e) =>
                  setValues({ ...values, endorsementNumber: e.target.value })
                }
              />
            </div>
          ) : null}
          <div>
            <Label className="text-xs">
              Detalle del endoso{isProposal ? " *" : ""}
            </Label>
            <Textarea
              rows={6}
              value={values.detail}
              onChange={(e) =>
                setValues({ ...values, detail: e.target.value })
              }
              placeholder="Ej: Mediante el presente endoso se incluye la cobertura de…"
            />
            {isProposal ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Va en el PDF de la solicitud de endoso que se envía a la
                compañía.
              </p>
            ) : null}
          </div>
          <div>
            <Label className="text-xs">
              {isProposal ? "Observaciones internas" : "Notas"}
            </Label>
            <Textarea
              rows={2}
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
              {submitting
                ? "Guardando…"
                : isProposal
                  ? "Crear propuesta de endoso"
                  : "Registrar endoso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
