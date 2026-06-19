"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { SettlementRow } from "../queries";
import {
  markSettlementPaidAction,
  deleteSettlementAction,
} from "../actions";
import { SETTLEMENT_STATUS_LABELS } from "../schemas";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function SettlementsList({
  rows,
  members,
}: {
  rows: SettlementRow[];
  members: { userId: string; name: string }[];
}) {
  const sellerName = useMemo(
    () => new Map(members.map((m) => [m.userId, m.name])),
    [members],
  );

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N°</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead className="text-right">Pólizas</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="w-40" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                Aún no hay liquidaciones generadas.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/comisiones/liquidaciones/${r.id}`}
                    className="hover:text-primary"
                  >
                    #{r.number}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">
                  {sellerName.get(r.salespersonId) ?? "—"}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {r._count.items}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {formatMoney(r.totalAmount, r.currency as CurrencyCode)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={r.status === "PAGADA" ? "default" : "secondary"}
                  >
                    {SETTLEMENT_STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString("es-CL")}
                </TableCell>
                <TableCell className="text-right">
                  <RowActions row={r} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function RowActions({ row }: { row: SettlementRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onMarkPaid() {
    startTransition(async () => {
      const res = await markSettlementPaidAction(row.id);
      if (res.ok) {
        toast.success("Liquidación marcada como pagada");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onDelete() {
    if (!confirm(`Eliminar liquidación #${row.number}?`)) return;
    startTransition(async () => {
      const res = await deleteSettlementAction(row.id);
      if (res.ok) {
        toast.success("Liquidación eliminada");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex justify-end gap-1">
      {row.status !== "PAGADA" ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onMarkPaid}
        >
          Marcar pagada
        </Button>
      ) : null}
      {row.status !== "PAGADA" ? (
        <Button
          variant="ghost"
          size="icon"
          disabled={pending}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
