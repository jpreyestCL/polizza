"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { updateEndorsementProposalAction } from "../actions";
import {
  endorsementProposalSchema,
  ENDORSEMENT_TYPES,
  ENDORSEMENT_TYPE_LABELS,
  type EndorsementProposalValues,
  type EndorsementTypeValue,
} from "../schemas";
import { Button } from "@/components/ui/button";
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

/** Edición de una propuesta de endoso (tipo, vigencia y detalle). */
export function EndorsementProposalForm({
  proposalId,
  defaultValues,
}: {
  proposalId: string;
  defaultValues: EndorsementProposalValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(defaultValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = endorsementProposalSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const r = await updateEndorsementProposalAction(proposalId, parsed.data);
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.success("Propuesta de endoso actualizada");
    router.push(`/propuestas/${proposalId}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-3xl space-y-4 rounded-lg border bg-card p-5"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Tipo de endoso *</Label>
          <Select
            value={values.type}
            onValueChange={(v) =>
              setValues({ ...values, type: v as EndorsementTypeValue })
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
          <Label className="text-xs">Inicio endoso *</Label>
          <Input
            type="date"
            value={values.effectiveDate}
            onChange={(e) =>
              setValues({ ...values, effectiveDate: e.target.value })
            }
          />
        </div>
        <div>
          <Label className="text-xs">Fin endoso</Label>
          <Input
            type="date"
            value={values.endDate}
            onChange={(e) => setValues({ ...values, endDate: e.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Delta prima afecta</Label>
          <Input
            inputMode="decimal"
            value={values.premiumAffectedDelta}
            onChange={(e) =>
              setValues({ ...values, premiumAffectedDelta: e.target.value })
            }
            placeholder="Vacío si no cambia"
          />
        </div>
        <div>
          <Label className="text-xs">Delta prima exenta</Label>
          <Input
            inputMode="decimal"
            value={values.premiumExemptDelta}
            onChange={(e) =>
              setValues({ ...values, premiumExemptDelta: e.target.value })
            }
            placeholder="Vacío si no cambia"
          />
        </div>
      </div>
      {values.type === "MODIFICA_MONTO_PRIMA" ? (
        <div>
          <Label className="text-xs">Nuevo monto asegurado del ítem</Label>
          <Input
            inputMode="decimal"
            value={values.newInsuredAmount}
            onChange={(e) =>
              setValues({ ...values, newInsuredAmount: e.target.value })
            }
          />
        </div>
      ) : null}
      {values.type === "CAMBIO_COMISION" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Nueva comisión afecta %</Label>
            <Input
              inputMode="decimal"
              value={values.commissionAffectPct}
              onChange={(e) =>
                setValues({ ...values, commissionAffectPct: e.target.value })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Nueva comisión exenta %</Label>
            <Input
              inputMode="decimal"
              value={values.commissionExemptPct}
              onChange={(e) =>
                setValues({ ...values, commissionExemptPct: e.target.value })
              }
            />
          </div>
        </div>
      ) : null}
      <div>
        <Label className="text-xs">Detalle del endoso *</Label>
        <Textarea
          rows={10}
          value={values.detail}
          onChange={(e) => setValues({ ...values, detail: e.target.value })}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Va en el PDF de la solicitud de endoso que se envía a la compañía.
        </p>
      </div>
      <div>
        <Label className="text-xs">Observaciones internas</Label>
        <Textarea
          rows={2}
          value={values.observations}
          onChange={(e) =>
            setValues({ ...values, observations: e.target.value })
          }
        />
      </div>
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/propuestas/${proposalId}`)}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
