"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import type { CarQuotationListItem } from "../queries";
import { QuotationStatusBadge } from "./quotation-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function QuotationsTable({
  quotations,
}: {
  quotations: CarQuotationListItem[];
}) {
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<CarQuotationListItem>[]>(
    () => [
      {
        accessorKey: "quotationNumber",
        header: "Número",
        cell: ({ row }) => (
          <Link
            href={`/cotizaciones/${row.original.id}`}
            className="font-medium hover:text-primary"
          >
            {row.original.quotationNumber}
          </Link>
        ),
      },
      {
        id: "client",
        header: "Cliente",
        accessorFn: (row) => row.client.name,
      },
      {
        id: "vehicle",
        header: "Vehículo",
        accessorFn: (row) =>
          [row.marca, row.modelo, row.anio].filter(Boolean).join(" ") || "—",
        cell: ({ row }) => (
          <div className="text-sm">
            <p>
              {[row.original.marca, row.original.modelo, row.original.anio]
                .filter(Boolean)
                .join(" ") || "—"}
            </p>
            <p className="text-xs text-muted-foreground">{row.original.patente}</p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ getValue }) => (
          <QuotationStatusBadge status={getValue<string>()} />
        ),
      },
      {
        id: "results",
        header: "Resultados",
        accessorFn: (row) => row.obtainedCount,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.obtainedCount}/{row.original.resultsCount}
          </span>
        ),
      },
      {
        id: "best",
        header: "Mejor prima",
        accessorFn: (row) => row.bestPremiumUf ?? 0,
        cell: ({ row }) =>
          row.original.bestPremiumUf !== null
            ? formatMoney(row.original.bestPremiumUf, "UF")
            : "—",
      },
      {
        accessorKey: "createdAt",
        header: "Creada",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {formatDate(getValue<Date>())}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: quotations,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 12 } },
  });

  const filteredRows = table.getFilteredRowModel().rows;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Filtrar por número, cliente o patente…"
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No hay cotizaciones que coincidan.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filteredRows.length}{" "}
          {filteredRows.length === 1 ? "cotización" : "cotizaciones"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft />
          </Button>
          <span>
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {Math.max(table.getPageCount(), 1)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
