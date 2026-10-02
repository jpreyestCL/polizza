"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NON_RENEWAL_REASONS,
  nonRenewalReasonLabel,
  type NonRenewalReason,
} from "../schemas";
import {
  recordNonRenewalAction,
  revertNonRenewalAction,
  setPolicyRenewableAction,
} from "../actions";

export function NonRenewalPanel({
  policyId,
  notRenewable,
  reason,
  note,
  recordedAt,
}: {
  policyId: string;
  notRenewable: boolean;
  reason: string | null;
  note: string | null;
  recordedAt: Date | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<NonRenewalReason>("CLIENT_REQUEST");
  const [comment, setComment] = useState("");

  async function run(task: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(true);
    const result = await task();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "No se pudo guardar.");
      return;
    }
    toast.success(success);
    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Renovación</h2>
          <p className="text-xs text-muted-foreground">
            La no renovación queda registrada y se puede revertir.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() =>
            run(
              () => setPolicyRenewableAction(policyId, notRenewable),
              notRenewable
                ? "La póliza vuelve a la cola de renovación"
                : "Póliza marcada como no renovable",
            )
          }
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          {notRenewable ? "Marcar como renovable" : "No renovable por naturaleza"}
        </Button>
      </div>

      {recordedAt ? (
        <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            No se renueva
            {reason ? `: ${nonRenewalReasonLabel(reason)}` : ""}
            {note ? `. ${note}` : ""}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              run(
                () => revertNonRenewalAction(policyId),
                "No renovación revertida",
              )
            }
          >
            Revertir
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () =>
                recordNonRenewalAction(policyId, {
                  reason: selected,
                  note: comment,
                }),
              "No renovación registrada",
            );
          }}
        >
          <div className="min-w-40 flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Motivo</label>
            <Select
              value={selected}
              onValueChange={(value) => setSelected(value as NonRenewalReason)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NON_RENEWAL_REASONS.map((code) => (
                  <SelectItem key={code} value={code}>
                    {nonRenewalReasonLabel(code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Nota</label>
            <Input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Opcional"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={busy}>
            No renovar
          </Button>
        </form>
      )}
    </section>
  );
}
