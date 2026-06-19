import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { canManageCommissions } from "@/lib/roles";
import { getSettlementDetail } from "@/features/commissions/queries";
import { getCompanies, getLines } from "@/features/catalog/queries";
import { getOrgMembers } from "@/features/clients/queries";
import { SETTLEMENT_STATUS_LABELS } from "@/features/commissions/schemas";
import { SettlementDetailActions } from "@/features/commissions/components/settlement-detail-actions";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function LiquidacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ctx, db } = await requireOrgDb();
  if (!canManageCommissions(ctx.role)) redirect("/panel");

  const { id } = await params;
  const [settlement, companies, lines, members] = await Promise.all([
    getSettlementDetail(db, id),
    getCompanies(db),
    getLines(db),
    getOrgMembers(ctx.organizationId),
  ]);
  if (!settlement) notFound();

  const companyName = new Map(companies.map((c) => [c.id, c.name]));
  const lineName = new Map(lines.map((l) => [l.id, l.name]));
  const sellerName = new Map(members.map((m) => [m.userId, m.name]));

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/comisiones/liquidaciones">
          <ArrowLeft className="mr-1 size-4" /> Liquidaciones
        </Link>
      </Button>
      <PageHeader
        title={`Liquidación #${settlement.number}`}
        description={`Vendedor: ${sellerName.get(settlement.salespersonId) ?? "—"}`}
        actions={
          <SettlementDetailActions
            id={settlement.id}
            number={settlement.number}
            status={settlement.status}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4 text-sm">
        <span>
          Estado:{" "}
          <Badge
            variant={settlement.status === "PAGADA" ? "default" : "secondary"}
          >
            {SETTLEMENT_STATUS_LABELS[settlement.status] ?? settlement.status}
          </Badge>
        </span>
        <span>
          Total:{" "}
          <strong>
            {formatMoney(
              settlement.totalAmount,
              settlement.currency as CurrencyCode,
            )}
          </strong>
        </span>
        <span className="text-muted-foreground">
          Generada: {new Date(settlement.createdAt).toLocaleDateString("es-CL")}
        </span>
        {settlement.paidAt ? (
          <span className="text-muted-foreground">
            Pagada: {new Date(settlement.paidAt).toLocaleDateString("es-CL")}
          </span>
        ) : null}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
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
            {settlement.items.map((it) => (
              <TableRow key={it.id}>
                <TableCell className="font-medium">
                  {it.policy.policyNumber}
                </TableCell>
                <TableCell className="text-sm">
                  {it.policy.client.name}
                </TableCell>
                <TableCell className="text-sm">
                  {it.policy.companyId
                    ? (companyName.get(it.policy.companyId) ?? "—")
                    : "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {it.policy.lineId
                    ? (lineName.get(it.policy.lineId) ?? "—")
                    : "—"}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatMoney(
                    it.baseCommissionAmount,
                    it.currency as CurrencyCode,
                  )}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {it.appliedPct}%
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {formatMoney(it.amount, it.currency as CurrencyCode)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
