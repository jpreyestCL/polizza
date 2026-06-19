"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  markSettlementPaidAction,
  deleteSettlementAction,
} from "../actions";
import { Button } from "@/components/ui/button";

export function SettlementDetailActions({
  id,
  number,
  status,
}: {
  id: string;
  number: number;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onMarkPaid() {
    startTransition(async () => {
      const res = await markSettlementPaidAction(id);
      if (res.ok) {
        toast.success("Liquidación marcada como pagada");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onDelete() {
    if (!confirm(`Eliminar liquidación #${number}?`)) return;
    startTransition(async () => {
      const res = await deleteSettlementAction(id);
      if (res.ok) {
        toast.success("Liquidación eliminada");
        router.push("/comisiones/liquidaciones");
      } else {
        toast.error(res.error);
      }
    });
  }

  if (status === "PAGADA") return null;

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={onMarkPaid}>
        Marcar pagada
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={onDelete}
      >
        Eliminar
      </Button>
    </div>
  );
}
