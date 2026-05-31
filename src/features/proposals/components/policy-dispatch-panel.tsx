"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Truck } from "lucide-react";
import { dispatchPolicyToContratanteAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type DocOption = { id: string; fileName: string };

/**
 * Despacho de la póliza al contratante (obs 19-20). Visible cuando la póliza
 * ya está recepcionada (EMITIDA o POR_DESPACHAR). Permite enviar la póliza por
 * email con documentos de la carátula, o marcarla como despachada.
 */
export function PolicyDispatchPanel({
  proposalId,
  status,
  defaultEmail,
  documents,
}: {
  proposalId: string;
  status: string;
  defaultEmail: string | null;
  documents: DocOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"send" | "mark">("send");
  const [toEmail, setToEmail] = useState(defaultEmail ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (status !== "EMITIDA" && status !== "POR_DESPACHAR") return null;

  function toggleDoc(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function submit() {
    setSubmitting(true);
    const r = await dispatchPolicyToContratanteAction(proposalId, {
      send: mode === "send",
      toEmail,
      subject,
      body,
      documentIds: selected,
    });
    setSubmitting(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(
      mode === "send"
        ? "Póliza despachada al contratante."
        : "Póliza marcada como despachada.",
    );
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b p-4">
        <Truck className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Despacho de la póliza</h2>
      </div>
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          La póliza está recepcionada. Envíala al contratante por email (con la
          póliza y los documentos seleccionados de la carátula) o márcala como
          despachada. Al despachar, la propuesta finaliza su flujo y la póliza
          queda visible en la cartera vigente.
        </p>

        <div className="inline-flex rounded-md border p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setMode("send")}
            className={`rounded px-3 py-1 ${
              mode === "send"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            Enviar al contratante
          </button>
          <button
            type="button"
            onClick={() => setMode("mark")}
            className={`rounded px-3 py-1 ${
              mode === "mark"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            Marcar como despachada
          </button>
        </div>

        {mode === "send" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Email del contratante *</Label>
                <Input
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="contratante@correo.cl"
                />
              </div>
              <div>
                <Label className="text-xs">Asunto (opcional)</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Se genera uno por defecto"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Mensaje (opcional)</Label>
              <Textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Se genera un mensaje por defecto si lo dejas vacío."
              />
            </div>
            {documents.length > 0 && (
              <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Documentos a adjuntar (la póliza se adjunta automáticamente)
                </div>
                {documents.map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={selected.includes(d.id)}
                      onCheckedChange={() => toggleDoc(d.id)}
                    />
                    {d.fileName}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={submit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="animate-spin" />
            ) : mode === "send" ? (
              <Send className="size-4" />
            ) : (
              <Truck className="size-4" />
            )}
            {mode === "send" ? "Enviar y despachar" : "Marcar como despachada"}
          </Button>
        </div>
      </div>
    </div>
  );
}
