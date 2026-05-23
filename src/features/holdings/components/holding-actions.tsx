"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { deleteHoldingAction } from "../actions";
import { HoldingDialog, type HoldingDraft } from "./holding-dialog";
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

export function HoldingActions({ holding }: { holding: HoldingDraft }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteHoldingAction(holding.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Holding eliminado");
    router.push("/holdings");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil />
        Editar
      </Button>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Eliminar holding">
            <Trash2 className="text-destructive" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar holding</DialogTitle>
            <DialogDescription>
              ¿Seguro que quieres eliminar{" "}
              <strong className="text-foreground">{holding.name}</strong>? Los
              clientes no se eliminan, solo dejan de pertenecer a este holding.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={deleting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <HoldingDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        holding={holding}
      />
    </div>
  );
}
