"use client";

import { ExternalLink, FileText } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CarQuotationDetail } from "../queries";
import { ResultStatusBadge } from "./quotation-badges";
import { ContractResultButton } from "./contract-result-button";
import { ReprocessButton } from "./reprocess-button";

export function ResultsTable({
  quotationId,
  results,
}: {
  quotationId: string;
  results: CarQuotationDetail["results"];
}) {
  const sorted = [...results].sort((a, b) => {
    const aP = a.premiumUf ?? Infinity;
    const bP = b.premiumUf ?? Infinity;
    return aP - bP;
  });
  const best =
    results
      .filter((r) => r.status === "OBTENIDA" && r.premiumUf !== null)
      .reduce(
        (acc, r) => (r.premiumUf! < acc ? r.premiumUf! : acc),
        Number.POSITIVE_INFINITY,
      ) || null;

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Aseguradora</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Prima anual</TableHead>
            <TableHead className="text-right">Deducible</TableHead>
            <TableHead>Diferencia</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r, idx) => {
            const diff =
              best !== null && r.premiumUf !== null ? r.premiumUf - best : null;
            const diffLabel =
              r.status !== "OBTENIDA" || diff === null
                ? "—"
                : diff === 0
                  ? "Mejor oferta"
                  : `+ UF ${diff.toFixed(2)}`;
            const pdfHref = `/api/cotizaciones/${quotationId}/result/${r.id}/pdf`;
            return (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.insurerName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.planName ?? "—"}
                </TableCell>
                <TableCell>
                  <ResultStatusBadge status={r.status} />
                  {r.status === "ERROR" && r.errorMessage && (
                    <p className="mt-1 text-xs text-destructive">
                      {r.errorMessage}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {r.premiumUf !== null ? formatMoney(r.premiumUf, "UF") : "—"}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {r.deductibleUf !== null
                    ? formatMoney(r.deductibleUf, "UF")
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {idx === 0 && r.status === "OBTENIDA" ? (
                    <span className="font-medium text-primary">{diffLabel}</span>
                  ) : (
                    diffLabel
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {r.status === "OBTENIDA" && (
                      <>
                        <Button asChild size="sm" variant="outline">
                          <a href={pdfHref} target="_blank" rel="noopener noreferrer">
                            <FileText />
                            PDF
                            <ExternalLink className="size-3" />
                          </a>
                        </Button>
                        <ContractResultButton
                          resultId={r.id}
                          insurerName={r.insurerName}
                          premiumLabel={formatMoney(r.premiumUf, "UF")}
                        />
                      </>
                    )}
                    {(r.status === "ERROR" || r.status === "OBTENIDA") && (
                      <ReprocessButton resultId={r.id} />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {sorted.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                Sin aseguradoras configuradas.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
