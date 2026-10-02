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
  kind = "POLIZA",
  defaultEffectiveDate = "",
}: {
  proposalId: string;
  status: string;
  /** ENDOSO: se recepciona el endoso emitido (N° de endoso). */
  kind?: string;
  /** ENDOSO: inicio de vigencia propuesto (se confirma con el emitido). */
  defaultEffectiveDate?: string;
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
  const [effectiveDate, setEffectiveDate] = useState(defaultEffectiveDate);

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
  const isEndorsement = kind === "ENDOSO";
  const numberLabel = isEndorsement
    ? "N° de endoso emitido *"
    : "N° de póliza generado *";

  async function submitOk() {
    const parsed = policyReceptionSchema.safeParse({
      policyNumber,
      emissionDate,
      receptionDate,
      note,
      effectiveDate: kind === "ENDOSO" ? effectiveDate : "",
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
    toast.success(
      isEndorsement
        ? "Endoso registrado en la póliza. Listo para despachar al cliente."
        : "Póliza registrada. Propuesta lista por despachar.",
    );
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
    toast.success(
      "Emitida con problemas. Queda por despachar; la corrección se pide con un endoso.",
    );
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b p-4">
        <FileCheck2 className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">
          {isReturned
            ? `Corrección ${isEndorsement ? "del endoso devuelto" : "de la póliza devuelta"}`
            : `Recepción ${isEndorsement ? "del endoso" : "de la póliza"}`}
        </h2>
      </div>
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          {isEndorsement ? (
            isReturned ? (
              <>
                El endoso fue devuelto a la compañía por un error de emisión.
                Cuando envíen el endoso corregido, revísalo y registra aquí la{" "}
                <strong>emisión correcta</strong> (queda{" "}
                <strong>Por despachar</strong>). Sube el PDF del endoso como
                documento tipo “Endoso”.
              </>
            ) : (
              <>
                A la espera de que la compañía emita el endoso. Revisa que se
                emitió bien y registra la emisión correcta: el endoso queda
                registrado en la póliza (una cancelación o anulación cambia su
                estado ahora, con vigencia desde el inicio del endoso) y la
                propuesta queda <strong>Por despachar</strong> al cliente. Si
                vino con problemas, regístralo igual: queda{" "}
                <strong>Por despachar</strong> y la corrección se pide con otro
                endoso. Sube el PDF del endoso en la pestaña Documentos como
                tipo “Endoso”.
              </>
            )
          ) : isReturned ? (
            <>
              La póliza fue devuelta a la compañía por un error de emisión.
              Cuando envíen la póliza corregida, registra aquí la{" "}
              <strong>emisión correcta</strong> con el número de póliza
              definitivo y sus fechas (la propuesta pasa a{" "}
              <strong>Por despachar</strong>). Sube el PDF definitivo en la
              pestaña Documentos.
            </>
          ) : (
            <>
              A la espera de que la compañía emita la póliza. La emisión correcta
              y la emisión con problemas dejan la propuesta en{" "}
              <strong>Por despachar</strong>. El problema queda marcado y se
              corrige con un endoso; no devuelve la propuesta. El PDF de la
              póliza se adjunta en la pestaña Documentos.
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
                <Label className="text-xs">{numberLabel}</Label>
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
              {isEndorsement ? (
                <div>
                  <Label className="text-xs">Inicio vigencia del endoso *</Label>
                  <Input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Según el endoso emitido. Desde esta fecha rige la
                    cancelación o anulación.
                  </p>
                </div>
              ) : null}
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
                Dejar por despachar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">{numberLabel}</Label>
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
                Registrar emisión con problemas
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
