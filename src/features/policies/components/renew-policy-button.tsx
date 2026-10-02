"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { renewPolicyAction } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RenewPolicyButton({
  policyId,
  policyNumber,
  variant = "outline",
}: {
  policyId: string;
  policyNumber: string;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRenew() {
    setLoading(true);
    const result = await renewPolicyAction(policyId);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Renovación abierta en elaboración");
    setOpen(false);
    router.push(`/propuestas/${result.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <RefreshCw />
          Renovar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renovar póliza</DialogTitle>
          <DialogDescription>
            Se abre una propuesta de renovación de{" "}
            <strong className="text-foreground">{policyNumber}</strong>, con la
            vigencia que empieza cuando termina esta. La póliza actual sigue
            vigente hasta que la sucesora se emita. Hay que confirmar la prima
            antes de enviarla.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={loading}>
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={handleRenew} disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Abrir renovación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
