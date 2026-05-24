"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { updateClaimCompanyInfoAction } from "../actions";
import type { ClaimCompanyInfoValues } from "../schemas";
import type { ClaimDetail } from "../queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toDateTimeInput(d: Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function ClaimCompanyInfoCard({ claim }: { claim: ClaimDetail }) {
  const router = useRouter();
  const [values, setValues] = useState<ClaimCompanyInfoValues>({
    companyClaimNumber: claim.companyClaimNumber ?? "",
    liquidatorName: claim.liquidatorName ?? "",
    filedAtCompanyAt: toDateTimeInput(claim.filedAtCompanyAt),
  });
  const [saving, startSaving] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startSaving(async () => {
      const result = await updateClaimCompanyInfoAction(claim.id, values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Datos de compañía guardados");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h3 className="text-sm font-semibold">Ingreso en la compañía</h3>
        <p className="text-xs text-muted-foreground">
          Una vez ingresado el denuncio, la compañía asigna número de siniestro
          y liquidador. Al guardar la fecha de ingreso por primera vez, el
          estado pasa a <em>Ingresado en compañía</em>.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase text-muted-foreground">
            Fecha y hora ingreso a la compañía
          </Label>
          <Input
            type="datetime-local"
            value={values.filedAtCompanyAt}
            onChange={(e) =>
              setValues({ ...values, filedAtCompanyAt: e.target.value })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase text-muted-foreground">
            N° siniestro compañía
          </Label>
          <Input
            value={values.companyClaimNumber}
            onChange={(e) =>
              setValues({ ...values, companyClaimNumber: e.target.value })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase text-muted-foreground">
            Liquidador asignado
          </Label>
          <Input
            value={values.liquidatorName}
            onChange={(e) =>
              setValues({ ...values, liquidatorName: e.target.value })
            }
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Guardar
        </Button>
      </div>
    </form>
  );
}
