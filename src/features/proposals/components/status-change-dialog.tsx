"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { changeProposalStatusAction } from "../actions";
import {
  PROPOSAL_STATUSES,
  STATUS_LABELS,
  type ProposalStatusValue,
} from "../schemas";
import type { CatalogItem } from "@/features/catalog/queries";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StatusChangeDialog({
  proposalId,
  currentStatus,
  returnReasons,
  open,
  onOpenChange,
  presetStatus,
}: {
  proposalId: string;
  currentStatus: ProposalStatusValue;
  returnReasons: CatalogItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetStatus?: ProposalStatusValue;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ProposalStatusValue>(
    presetStatus ?? currentStatus,
  );
  const [note, setNote] = useState("");
  const [returnReasonId, setReturnReasonId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus(presetStatus ?? currentStatus);
      setNote("");
      setReturnReasonId("");
    }
  }, [open, presetStatus, currentStatus]);

  async function handleSubmit() {
    setLoading(true);
    const result = await changeProposalStatusAction(proposalId, {
      status,
      note,
      returnReasonId,
    });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Estado actualizado");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar estado</DialogTitle>
          <DialogDescription>
            Registra el avance de la propuesta. El cambio queda en el historial.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {presetStatus ? (
            <p className="text-sm">
              Nuevo estado:{" "}
              <strong className="text-foreground">
                {STATUS_LABELS[presetStatus]}
              </strong>
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label>Nuevo estado</Label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as ProposalStatusValue)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPOSAL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {status === "DEVUELTA" && (
            <div className="space-y-1.5">
              <Label>Motivo de devolución</Label>
              <Select
                value={returnReasonId || undefined}
                onValueChange={setReturnReasonId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {returnReasons.map((reason) => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="status-note">Nota (opcional)</Label>
            <Textarea
              id="status-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
