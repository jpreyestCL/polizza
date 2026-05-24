"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MessageSquarePlus } from "lucide-react";
import type { ClaimLog, ClaimLogKind } from "@prisma/client";
import { addClaimNoteAction } from "../actions";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const KIND_LABEL: Record<ClaimLogKind, string> = {
  CREATED: "Creado",
  STATUS_CHANGED: "Estado",
  COMPANY_FILED: "Ingresado en compañía",
  COMPANY_NUMBER_ASSIGNED: "N° compañía",
  LIQUIDATOR_ASSIGNED: "Liquidador",
  DOCUMENT_UPLOADED: "Documento",
  THIRD_PARTY_ADDED: "Tercero +",
  THIRD_PARTY_REMOVED: "Tercero −",
  UPDATED: "Actualizado",
  NOTE: "Nota",
};

const KIND_VARIANT: Record<ClaimLogKind, "default" | "secondary" | "success" | "warning" | "destructive" | "muted"> = {
  CREATED: "secondary",
  STATUS_CHANGED: "default",
  COMPANY_FILED: "warning",
  COMPANY_NUMBER_ASSIGNED: "warning",
  LIQUIDATOR_ASSIGNED: "warning",
  DOCUMENT_UPLOADED: "muted",
  THIRD_PARTY_ADDED: "success",
  THIRD_PARTY_REMOVED: "muted",
  UPDATED: "muted",
  NOTE: "default",
};

export function ClaimLogPanel({
  claimId,
  logs,
}: {
  claimId: string;
  logs: ClaimLog[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [saving, startSaving] = useTransition();

  function addNote() {
    if (!note.trim()) return;
    startSaving(async () => {
      const r = await addClaimNoteAction(claimId, { message: note });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Nota agregada");
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">Agregar nota a la bitácora</p>
        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Llamada con liquidador, espera de documento, etc."
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={addNote} disabled={saving || !note.trim()} size="sm">
            {saving ? (
              <Loader2 className="animate-spin" />
            ) : (
              <MessageSquarePlus />
            )}
            Agregar nota
          </Button>
        </div>
      </div>

      {logs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          La bitácora está vacía.
        </p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li
              key={log.id}
              className="flex items-start gap-3 rounded-lg border bg-card p-3"
            >
              <Badge variant={KIND_VARIANT[log.kind]}>
                {KIND_LABEL[log.kind]}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm whitespace-pre-wrap">{log.message}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(log.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
