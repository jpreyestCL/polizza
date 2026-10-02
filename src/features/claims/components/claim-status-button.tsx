"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { changeClaimStatusAction } from "../actions";
import {
  CLAIM_STATUS_LABELS,
  CLOSURE_OUTCOME_LABELS,
  type ClaimStatusValue,
  type ClosureOutcome,
} from "../schemas";
import {
  closureOutcomesFor,
  nextClaimStatuses,
} from "@/lib/domain/claim-lifecycle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
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

export function ClaimStatusButton({
  claimId,
  currentStatus,
}: {
  claimId: string;
  currentStatus: ClaimStatusValue;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const options = nextClaimStatuses(currentStatus);
  const [status, setStatus] = useState<ClaimStatusValue>(options[0] ?? currentStatus);
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [filedAtCompanyAt, setFiledAtCompanyAt] = useState("");
  const [companyClaimNumber, setCompanyClaimNumber] = useState("");
  const [liquidatorName, setLiquidatorName] = useState("");
  const [settledAmount, setSettledAmount] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus(nextClaimStatuses(currentStatus)[0] ?? currentStatus);
      setOutcome("");
      setNote("");
      setError("");
    }
  }, [open, currentStatus]);

  async function handleSubmit() {
    setLoading(true);
    setError("");
    const result = await changeClaimStatusAction(claimId, {
      status,
      note,
      closureOutcome: outcome,
      filedAtCompanyAt,
      companyClaimNumber,
      liquidatorName,
      settledAmount,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Estado actualizado");
    setOpen(false);
    router.refresh();
  }

  if (options.length === 0) return null;
  const outcomes = closureOutcomesFor(status);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <ArrowLeftRight />
        Cambiar estado
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar estado del siniestro</DialogTitle>
            <DialogDescription>
              El cambio queda registrado en el historial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nuevo estado</Label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as ClaimStatusValue)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CLAIM_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {outcomes.length > 0 ? (
              <div className="space-y-1.5">
                <Label>Resultado del cierre</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige el resultado" />
                  </SelectTrigger>
                  <SelectContent>
                    {outcomes.map((value: ClosureOutcome) => (
                      <SelectItem key={value} value={value}>
                        {CLOSURE_OUTCOME_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {status === "AWAITING_ASSIGNMENT" ? (
              <div className="space-y-1.5">
                <Label htmlFor="claim-filed-at">
                  Fecha de envío a la compañía
                </Label>
                <Input
                  id="claim-filed-at"
                  type="datetime-local"
                  value={filedAtCompanyAt}
                  onChange={(e) => setFiledAtCompanyAt(e.target.value)}
                />
              </div>
            ) : null}
            {status === "IN_ADJUSTMENT" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="claim-company-number">
                    N° siniestro compañía
                  </Label>
                  <Input
                    id="claim-company-number"
                    value={companyClaimNumber}
                    onChange={(e) => setCompanyClaimNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="claim-liquidator">Liquidador</Label>
                  <Input
                    id="claim-liquidator"
                    value={liquidatorName}
                    onChange={(e) => setLiquidatorName(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
            {status === "PAYMENT_PROCESS" ? (
              <div className="space-y-1.5">
                <Label htmlFor="claim-settled">Indemnización</Label>
                <Input
                  id="claim-settled"
                  inputMode="decimal"
                  value={settledAmount}
                  onChange={(e) => setSettledAmount(e.target.value)}
                />
              </div>
            ) : null}
            {error ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="claim-status-note">Nota (opcional)</Label>
              <RichTextEditor
                value={note}
                onChange={setNote}
                minHeightClass="min-h-[90px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
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
    </>
  );
}
