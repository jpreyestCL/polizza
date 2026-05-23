"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { contractResultAction } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ContractResultButton({
  resultId,
  insurerName,
  premiumLabel,
}: {
  resultId: string;
  insurerName: string;
  premiumLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    const result = await contractResultAction(resultId);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Propuesta creada desde la cotización");
    setOpen(false);
    router.push(`/propuestas/${result.proposalId}`);
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="default"
        onClick={() => setOpen(true)}
      >
        <CheckCircle2 />
        Contratar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contratar con {insurerName}</DialogTitle>
            <DialogDescription>
              Se creará una propuesta en estado <strong>Elaboración</strong> con
              la prima cotizada ({premiumLabel}) y el cliente actual. Luego
              podrás editarla en el flujo de propuestas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handle} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Crear propuesta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
