"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, Mail, Paperclip, RotateCcw, Send, X } from "lucide-react";
import {
  generateAndStoreProposalPdfAction,
  reopenProposalAction,
  sendProposalByEmailAction,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";

type ProposalDocument = {
  id: string;
  fileName: string;
};

type CompanyContact = {
  id: string;
  name: string;
  lastName: string | null;
  email: string | null;
  isDefault: boolean;
};

export function PdfAndEmailButtons({
  proposalId,
  proposalNumber,
  clientName,
  organizationName,
  defaultEmail,
  contacts,
  documents,
  status,
  hasStoredPdf,
}: {
  proposalId: string;
  proposalNumber: string;
  clientName: string;
  organizationName: string;
  defaultEmail: string | null;
  contacts: CompanyContact[];
  documents: ProposalDocument[];
  status: string;
  hasStoredPdf: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const isElaboration = status === "ELABORACION" || status === "DEVUELTA";
  const isPorEnviar = status === "POR_ENVIAR";

  function handleGeneratePdf() {
    startTransition(async () => {
      const r = await generateAndStoreProposalPdfAction(proposalId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "PDF generado");
      router.refresh();
    });
  }

  function handleReopen() {
    if (
      !confirm(
        "¿Reabrir la propuesta? Se eliminará el PDF guardado y volverá a Elaboración.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await reopenProposalAction(proposalId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Propuesta reabierta");
      router.refresh();
    });
  }
  const defaultContact = contacts.find((c) => c.isDefault) ?? contacts[0];
  const [contactName, setContactName] = useState(
    defaultContact
      ? `${defaultContact.name}${defaultContact.lastName ? " " + defaultContact.lastName : ""}`
      : "",
  );
  const [to, setTo] = useState(
    defaultEmail ?? defaultContact?.email ?? "",
  );
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const [subject, setSubject] = useState(
    `Propuesta de Seguro N° ${proposalNumber} de ${organizationName} - ${clientName}`,
  );
  const [body, setBody] = useState(
    `Estimados,\n\nFavor asignar folio/ciclo para la emisión de la propuesta N° ${proposalNumber} a nombre de ${clientName}.\n\nFavor acusar recibo de la recepción de este correo.\n\nLes saluda atentamente,\n${organizationName}`,
  );
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [markOnly, setMarkOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function pickContact(id: string) {
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    setContactName(`${c.name}${c.lastName ? " " + c.lastName : ""}`);
    if (c.email) setTo(c.email);
  }

  function addCc(value: string, target: "cc" | "bcc") {
    const v = value.trim();
    if (!v) return;
    if (target === "cc") {
      if (!cc.includes(v)) setCc([...cc, v]);
      setCcInput("");
    } else {
      if (!bcc.includes(v)) setBcc([...bcc, v]);
      setBccInput("");
    }
  }

  async function handleSend() {
    setSubmitting(true);
    const r = await sendProposalByEmailAction(proposalId, {
      toEmail: to,
      cc,
      bcc,
      subject,
      body,
      documentIds: selectedDocs,
      markOnly,
    });
    setSubmitting(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(r.message ?? "Listo");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {hasStoredPdf ? (
        <Button asChild variant="outline">
          <a
            href={`/api/propuestas/${proposalId}/pdf`}
            target="_blank"
            rel="noreferrer"
          >
            <FileText />
            Ver PDF
          </a>
        </Button>
      ) : isElaboration ? (
        <Button variant="outline" onClick={handleGeneratePdf}>
          <FileText />
          Generar PDF
        </Button>
      ) : (
        <Button asChild variant="outline">
          <a
            href={`/api/propuestas/${proposalId}/pdf`}
            target="_blank"
            rel="noreferrer"
          >
            <FileText />
            PDF
          </a>
        </Button>
      )}
      {isPorEnviar && (
        <Button variant="outline" onClick={handleReopen}>
          <RotateCcw />
          Reabrir propuesta
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={isElaboration}>
            <Mail />
            Enviar a la cía.
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Envío de Propuesta a la compañía</DialogTitle>
            <DialogDescription>
              Confirma destinatarios, asunto y documentos. La propuesta se
              adjunta automáticamente como PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Para (contacto)</Label>
                <div className="flex gap-2">
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Nombre del contacto"
                  />
                  {contacts.length > 0 && (
                    <select
                      className="rounded-md border bg-background px-2 text-xs"
                      onChange={(e) => {
                        if (e.target.value) pickContact(e.target.value);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Elegir
                      </option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.lastName ? " " + c.lastName : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  disabled={markOnly}
                  required
                />
              </div>
            </div>

            <ChipsField
              label="CC"
              chips={cc}
              onRemove={(v) => setCc(cc.filter((c) => c !== v))}
              inputValue={ccInput}
              onInputChange={setCcInput}
              onAdd={(v) => addCc(v, "cc")}
              disabled={markOnly}
            />
            <ChipsField
              label="CCO"
              chips={bcc}
              onRemove={(v) => setBcc(bcc.filter((c) => c !== v))}
              inputValue={bccInput}
              onInputChange={setBccInput}
              onAdd={(v) => addCc(v, "bcc")}
              disabled={markOnly}
            />

            <div>
              <Label className="text-xs">Asunto *</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={markOnly}
              />
            </div>

            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Paperclip className="size-3.5" /> Propuesta Adjunta:
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">
                  propuesta-{proposalNumber}.pdf
                </span>
              </div>
              {documents.length > 0 && (
                <div className="mt-2">
                  <div className="mb-1.5 text-xs font-medium">
                    Adjuntar otros documentos (se incluyen como links en el email):
                  </div>
                  <div className="grid max-h-32 grid-cols-2 gap-1 overflow-y-auto">
                    {documents.map((d) => (
                      <label
                        key={d.id}
                        className="flex items-start gap-2 rounded-md border bg-background px-2 py-1 text-xs"
                      >
                        <Checkbox
                          checked={selectedDocs.includes(d.id)}
                          onCheckedChange={(v) =>
                            setSelectedDocs(
                              v === true
                                ? [...selectedDocs, d.id]
                                : selectedDocs.filter((id) => id !== d.id),
                            )
                          }
                        />
                        <span className="truncate" title={d.fileName}>
                          {d.fileName}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Comentarios en email</Label>
              <Textarea
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={markOnly}
                className="font-mono text-xs"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={markOnly}
                onCheckedChange={(v) => setMarkOnly(v === true)}
              />
              Solo marcar como enviada (sin envío real)
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSend} disabled={submitting}>
              <Send />
              {submitting
                ? "Enviando…"
                : markOnly
                  ? "Marcar enviada"
                  : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChipsField({
  label,
  chips,
  onRemove,
  inputValue,
  onInputChange,
  onAdd,
  disabled,
}: {
  label: string;
  chips: string[];
  onRemove: (v: string) => void;
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-1.5">
        {chips.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
          >
            {c}
            <button
              type="button"
              onClick={() => onRemove(c)}
              disabled={disabled}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Quitar ${c}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          type="email"
          value={inputValue}
          disabled={disabled}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (
              (e.key === "Enter" || e.key === "," || e.key === " ") &&
              inputValue.trim()
            ) {
              e.preventDefault();
              onAdd(inputValue);
            }
          }}
          onBlur={() => {
            if (inputValue.trim()) onAdd(inputValue);
          }}
          placeholder={chips.length === 0 ? "email@compañía.cl, Enter para agregar" : ""}
          className="flex-1 min-w-[180px] bg-transparent text-sm outline-none"
        />
      </div>
    </div>
  );
}
