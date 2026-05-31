"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileCheck2, Loader2 } from "lucide-react";
import {
  registerPolicyEmissionAction,
  registerEmissionErrorAction,
} from "../actions";
import {
  EMISSION_ERROR_REASONS,
  policyReceptionSchema,
  emissionErrorSchema,
  type EmissionErrorReason,
} from "../schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Recepción de la póliza emitida por la compañía. Disponible cuando la
 * propuesta fue enviada y se está a la espera de la emisión.
 */
export function PolicyReceptionPanel({
  proposalId,
  status,
}: {
  proposalId: string;
  status: string;
}) {
  const router = useRouter();
  // Tras una devolución (obs 17) el flujo natural es registrar la emisión
  // corregida, así que arrancamos en "emisión correcta".
  const [mode, setMode] = useState<"ok" | "error">("ok");
  const isReturned = status === "DEVUELTA";

  // Emisión correcta
  const [policyNumber, setPolicyNumber] = useState("");
  const [emissionDate, setEmissionDate] = useState("");
  const [receptionDate, setReceptionDate] = useState("");
  const [note, setNote] = useState("");

  // Error de emisión
  const [reason, setReason] = useState<EmissionErrorReason | "">("");
  const [detail, setDetail] = useState("");
  const [errPolicyNumber, setErrPolicyNumber] = useState("");
  const [errReceptionDate, setErrReceptionDate] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Se muestra mientras se espera la emisión (ENVIADA_COMPANIA) o cuando la
  // póliza fue devuelta con error y se está a la espera de la corrección
  // (DEVUELTA, obs 17).
  if (status !== "ENVIADA_COMPANIA" && status !== "DEVUELTA") return null;

  async function submitOk() {
    const parsed = policyReceptionSchema.safeParse({
      policyNumber,
      emissionDate,
      receptionDate,
      note,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const r = await registerPolicyEmissionAction(proposalId, parsed.data);
    setSubmitting(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Póliza registrada. Propuesta marcada como Emitida.");
    router.refresh();
  }

  async function submitError() {
    const parsed = emissionErrorSchema.safeParse({
      reason,
      detail,
      policyNumber: errPolicyNumber,
      receptionDate: errReceptionDate,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const r = await registerEmissionErrorAction(proposalId, parsed.data);
    setSubmitting(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Registrada como devuelta a la compañía.");
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b p-4">
        <FileCheck2 className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">
          {isReturned
            ? "Corrección de la póliza devuelta"
            : "Recepción de la póliza"}
        </h2>
      </div>
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          {isReturned ? (
            <>
              La póliza fue devuelta a la compañía por un error de emisión.
              Cuando envíen la póliza corregida, registra aquí la{" "}
              <strong>emisión correcta</strong> con el número de póliza
              definitivo y sus fechas (la propuesta pasa a{" "}
              <strong>Emitida</strong>). Sube el PDF definitivo en la pestaña
              Documentos.
            </>
          ) : (
            <>
              A la espera de que la compañía emita la póliza. Registra la emisión
              correcta (la propuesta pasa a <strong>Emitida</strong>) o el error
              de emisión (queda <strong>Devuelta a la compañía</strong>). El PDF
              de la póliza se adjunta en la pestaña Documentos.
            </>
          )}
        </p>

        <div className="inline-flex rounded-md border p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setMode("ok")}
            className={`rounded px-3 py-1 ${
              mode === "ok"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            Emisión correcta
          </button>
          <button
            type="button"
            onClick={() => setMode("error")}
            className={`rounded px-3 py-1 ${
              mode === "error"
                ? "bg-destructive text-destructive-foreground"
                : "text-muted-foreground"
            }`}
          >
            Emitida con error
          </button>
        </div>

        {mode === "ok" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">N° de póliza generado *</Label>
                <Input
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                  placeholder="Ej: 25048843"
                />
              </div>
              <div>
                <Label className="text-xs">Fecha de emisión *</Label>
                <Input
                  type="date"
                  value={emissionDate}
                  onChange={(e) => setEmissionDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Fecha de recepción *</Label>
                <Input
                  type="date"
                  value={receptionDate}
                  onChange={(e) => setReceptionDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Nota (opcional)</Label>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={submitOk} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FileCheck2 className="size-4" />
                )}
                Dejar póliza emitida
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">N° de póliza generado *</Label>
                <Input
                  value={errPolicyNumber}
                  onChange={(e) => setErrPolicyNumber(e.target.value)}
                  placeholder="Ej: 25048843"
                />
              </div>
              <div>
                <Label className="text-xs">Fecha de recepción *</Label>
                <Input
                  type="date"
                  value={errReceptionDate}
                  onChange={(e) => setErrReceptionDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Motivo del error *</Label>
                <Select
                  value={reason || undefined}
                  onValueChange={(v) => setReason(v as EmissionErrorReason)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMISSION_ERROR_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Describe el problema</Label>
              <Textarea
                rows={2}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Detalle del error de emisión"
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="destructive"
                onClick={submitError}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <AlertTriangle className="size-4" />
                )}
                Devolver a la compañía
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
