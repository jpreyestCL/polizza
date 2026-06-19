"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SalespersonRateRow } from "../queries";
import { salespersonRateSchema } from "../schemas";
import { upsertSalespersonRateAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Member = { userId: string; name: string; email: string };

export function RatesPanel({
  members,
  rates,
}: {
  members: Member[];
  rates: SalespersonRateRow[];
}) {
  const rateByUser = new Map(rates.map((r) => [r.userId, r]));
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendedor</TableHead>
            <TableHead className="w-40">% comisión default</TableHead>
            <TableHead className="w-28">Activa</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No hay miembros en la organización.
              </TableCell>
            </TableRow>
          ) : (
            members.map((m) => (
              <RateRow
                key={m.userId}
                member={m}
                rate={rateByUser.get(m.userId) ?? null}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function RateRow({
  member,
  rate,
}: {
  member: Member;
  rate: SalespersonRateRow | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pct, setPct] = useState(rate ? String(rate.defaultPct) : "");
  const [active, setActive] = useState(rate ? rate.isActive : true);

  function onSave() {
    const parsed = salespersonRateSchema.safeParse({
      userId: member.userId,
      defaultPct: pct,
      isActive: active,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    startTransition(async () => {
      const res = await upsertSalespersonRateAction(parsed.data);
      if (res.ok) {
        toast.success(`Tasa de ${member.name} guardada`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{member.name}</div>
        <div className="text-xs text-muted-foreground">{member.email}</div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            inputMode="decimal"
            className="w-24"
            value={pct}
            placeholder="0"
            onChange={(e) => setPct(e.target.value)}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </TableCell>
      <TableCell>
        <Checkbox
          checked={active}
          onCheckedChange={(v) => setActive(Boolean(v))}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="outline" disabled={pending} onClick={onSave}>
          {pending ? "…" : "Guardar"}
        </Button>
      </TableCell>
    </TableRow>
  );
}
