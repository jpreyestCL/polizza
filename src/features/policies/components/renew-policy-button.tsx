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
    toast.success("Póliza renovada");
    setOpen(false);
    router.push(`/polizas/${result.id}/editar`);
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
            Se creará una nueva póliza copiando los datos de{" "}
            <strong className="text-foreground">{policyNumber}</strong>, con la
            vigencia adelantada un año. La póliza actual quedará como Renovada.
            Podrás ajustar el número y las fechas a continuación.
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
            Renovar póliza
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
