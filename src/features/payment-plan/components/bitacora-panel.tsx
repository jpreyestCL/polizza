"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { History, Plus } from "lucide-react";
import { addProposalLogAction } from "../actions";
import { proposalLogSchema, type ProposalLogValues } from "../schemas";
import type { OrgMember } from "@/features/clients/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

type LogRow = {
  id: string;
  action: string;
  summary: string;
  nextDueDate: Date | null;
  responsibleUserId: string | null;
  userId: string | null;
  createdAt: Date;
};

const EMPTY: ProposalLogValues = {
  action: "NOTE",
  summary: "",
  nextDueDate: "",
  responsibleUserId: "",
};

const ACTION_LABEL: Record<string, string> = {
  CREATED: "Creación",
  STATUS_CHANGED: "Cambio de estado",
  ITEM_CREATED: "Ítem creado",
  ITEM_UPDATED: "Ítem actualizado",
  ITEM_DELETED: "Ítem eliminado",
  ITEMS_BULK_CREATED: "Carga masiva",
  PAYMENT_PLAN_UPDATED: "Plan de pago",
  EMAIL_SENT: "Email enviado",
  EMAIL_MARKED: "Marcada como enviada",
  NOTE: "Nota",
};

export function BitacoraPanel({
  proposalId,
  logs,
  members,
  timezone,
}: {
  proposalId: string;
  logs: LogRow[];
  members: OrgMember[];
  timezone?: string;
}) {
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: timezone || undefined,
    }).format(d);
  const fmtTime = (d: Date) =>
    new Intl.DateTimeFormat("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone || undefined,
    }).format(d);
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Bitácora</h2>
        </div>
        <BitacoraDialog
          proposalId={proposalId}
          open={open}
          onOpenChange={setOpen}
          members={members}
        />
      </div>
      {logs.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Sin entradas en la bitácora.
        </div>
      ) : (
        <ul className="divide-y">
          {logs.map((log) => (
            <li key={log.id} className="flex items-start gap-3 p-3">
              <div className="mt-0.5 w-24 shrink-0 text-xs text-muted-foreground">
                {fmtDate(log.createdAt)}
                <br />
                <span className="text-[10px]">{fmtTime(log.createdAt)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {ACTION_LABEL[log.action] ?? log.action}
                  </Badge>
                  {log.nextDueDate && (
                    <span className="text-[11px] text-amber-600">
                      Próx. vencimiento: {fmtDate(log.nextDueDate)}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm">{log.summary}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BitacoraDialog({
  proposalId,
  open,
  onOpenChange,
  members,
}: {
  proposalId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  members: OrgMember[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = proposalLogSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const r = await addProposalLogAction(proposalId, parsed.data);
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.success("Entrada agregada");
    onOpenChange(false);
    setValues(EMPTY);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Nueva entrada
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar entrada de bitácora</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs">Asunto / Acción *</Label>
            <Input
              value={values.summary}
              onChange={(e) =>
                setValues({ ...values, summary: e.target.value })
              }
              placeholder="Describe la acción"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Próximo vencimiento</Label>
              <Input
                type="date"
                value={values.nextDueDate}
                onChange={(e) =>
                  setValues({ ...values, nextDueDate: e.target.value })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Responsable</Label>
              <Select
                value={values.responsibleUserId || undefined}
                onValueChange={(v) =>
                  setValues({
                    ...values,
                    responsibleUserId: v === "__NONE" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE">— Sin asignar —</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
