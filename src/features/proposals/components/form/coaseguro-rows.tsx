"use client";

import { useFieldArray, type UseFormReturn } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProposalFormValues } from "../../schemas";

type CompanyOpt = { id: string; name: string };

export function CoaseguroRows({
  form,
  companies,
}: {
  form: UseFormReturn<ProposalFormValues>;
  companies: CompanyOpt[];
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "coaseguroParticipations",
  });

  const rows = form.watch("coaseguroParticipations") ?? [];
  const total = rows.reduce(
    (s, r) => s + (Number(r.participationPct) || 0),
    0,
  );
  const ok = Math.abs(total - 100) < 0.01;

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase text-muted-foreground">
          Compañías en coaseguro
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            append({
              insuranceCompanyId: "",
              participationPct: "",
              policyNumber: "",
            })
          }
        >
          <Plus className="size-3" /> Añadir
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aún no hay compañías en coaseguro.
        </p>
      ) : (
        <div className="space-y-2">
          {fields.map((f, idx) => (
            <div
              key={f.id}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_160px_auto]"
            >
              <Select
                value={
                  form.watch(
                    `coaseguroParticipations.${idx}.insuranceCompanyId`,
                  ) || undefined
                }
                onValueChange={(v) =>
                  form.setValue(
                    `coaseguroParticipations.${idx}.insuranceCompanyId`,
                    v,
                    { shouldDirty: true },
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Compañía" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                inputMode="decimal"
                placeholder="% participación"
                value={
                  form.watch(`coaseguroParticipations.${idx}.participationPct`) ??
                  ""
                }
                onChange={(e) =>
                  form.setValue(
                    `coaseguroParticipations.${idx}.participationPct`,
                    e.target.value,
                    { shouldDirty: true },
                  )
                }
              />
              <Input
                placeholder="N° póliza"
                value={
                  form.watch(`coaseguroParticipations.${idx}.policyNumber`) ?? ""
                }
                onChange={(e) =>
                  form.setValue(
                    `coaseguroParticipations.${idx}.policyNumber`,
                    e.target.value,
                    { shouldDirty: true },
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Eliminar"
                onClick={() => remove(idx)}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          <div
            className={
              "text-right text-xs " +
              (ok ? "text-muted-foreground" : "text-destructive font-medium")
            }
          >
            Total: {total.toFixed(2)}% {ok ? "" : "(debe sumar 100%)"}
          </div>
        </div>
      )}
    </div>
  );
}
