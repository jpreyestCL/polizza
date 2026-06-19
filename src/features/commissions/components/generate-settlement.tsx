"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { SettleablePolicy } from "../queries";
import { generateSettlementAction } from "../actions";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CatalogItem = { id: string; name: string };

export function GenerateSettlement({
  salespersonId,
  members,
  rows,
  defaultPct,
  companies,
  lines,
}: {
  salespersonId: string | null;
  members: { userId: string; name: string }[];
  rows: SettleablePolicy[];
  defaultPct: number | null;
  companies: CatalogItem[];
  lines: CatalogItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const companyName = useMemo(
    () => new Map(companies.map((c) => [c.id, c.name])),
    [companies],
  );
  const lineName = useMemo(
    () => new Map(lines.map((l) => [l.id, l.name])),
    [lines],
  );

  function pickSalesperson(v: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (v === "all") params.delete("vendedor");
    else params.set("vendedor", v);
    setSelected(new Set());
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.policyId)),
    );
  }

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.policyId)),
    [rows, selected],
  );
  const total = useMemo(
    () => selectedRows.reduce((acc, r) => acc + r.payout, 0),
    [selectedRows],
  );
  const selectedCurrencies = useMemo(
    () => new Set(selectedRows.map((r) => r.currency)),
    [selectedRows],
  );
  const mixedCurrency = selectedCurrencies.size > 1;
  const totalCurrency =
    selectedCurrencies.size === 1
      ? (selectedRows[0]?.currency as CurrencyCode)
      : "CLP";

  function onGenerate() {
    if (!salespersonId || selected.size === 0 || mixedCurrency) return;
    startTransition(async () => {
      const res = await generateSettlementAction({
        salespersonId,
        policyIds: Array.from(selected),
        notes: "",
      });
      if (res.ok) {
        toast.success("Liquidación generada");
        setSelected(new Set());
        router.push(`/comisiones/liquidaciones/${res.id}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Vendedor</Label>
          <Select value={salespersonId ?? "all"} onValueChange={pickSalesperson}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecciona un vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Selecciona un vendedor</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {salespersonId ? (
          <div className="text-sm text-muted-foreground">
            Tasa default:{" "}
            {defaultPct != null ? `${defaultPct}%` : "sin configurar"}
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm">
            Seleccionado:{" "}
            <strong>{formatMoney(total, totalCurrency)}</strong> (
            {selected.size})
          </span>
          <Button
            size="sm"
            disabled={
              !salespersonId || selected.size === 0 || mixedCurrency || pending
            }
            onClick={onGenerate}
          >
            {pending ? "Generando…" : "Crear liquidación"}
          </Button>
        </div>
      </div>
      {mixedCurrency ? (
        <p className="text-sm text-destructive">
          Seleccionaste pólizas en distintas monedas (
          {Array.from(selectedCurrencies).join(", ")}). Genera una liquidación
          por moneda.
        </p>
      ) : null}

      {!salespersonId ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Selecciona un vendedor para ver sus pólizas pagadas por la compañía y
          pendientes de liquidar.
        </p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={rows.length > 0 && selected.size === rows.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>N° Póliza</TableHead>
                <TableHead>Contratante</TableHead>
                <TableHead>Compañía</TableHead>
                <TableHead>Ramo</TableHead>
                <TableHead className="text-right">Comisión corredora</TableHead>
                <TableHead className="text-right">Tasa</TableHead>
                <TableHead className="text-right">Pago vendedor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No hay pólizas liquidables para este vendedor (deben estar
                    pagadas por la compañía y no liquidadas).
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.policyId}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(r.policyId)}
                        onCheckedChange={() => toggle(r.policyId)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {r.policyNumber}
                    </TableCell>
                    <TableCell className="text-sm">{r.clientName}</TableCell>
                    <TableCell className="text-sm">
                      {r.companyId ? (companyName.get(r.companyId) ?? "—") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.lineId ? (lineName.get(r.lineId) ?? "—") : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatMoney(
                        r.brokerCommission,
                        r.currency as CurrencyCode,
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.appliedPct != null ? `${r.appliedPct}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatMoney(r.payout, r.currency as CurrencyCode)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
