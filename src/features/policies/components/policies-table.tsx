"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { PolicyListItem } from "../queries";
import type { CatalogItem } from "@/features/catalog/queries";
import {
  POLICY_STATUSES,
  POLICY_STATUS_LABELS,
  type PolicyStatusValue,
} from "../schemas";
import { PolicyRenewalBadge, PolicyStatusBadge } from "./policy-badges";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function PoliciesTable({
  policies,
  companies,
}: {
  policies: PolicyListItem[];
  companies: CatalogItem[];
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const companyName = useMemo(
    () => new Map(companies.map((c) => [c.id, c.name])),
    [companies],
  );

  const columns = useMemo<ColumnDef<PolicyListItem>[]>(
    () => [
      {
        accessorKey: "policyNumber",
        header: "Número",
        cell: ({ row }) => (
          <Link
            href={`/polizas/${row.original.id}`}
            className="font-medium hover:text-primary"
          >
            {row.original.policyNumber}
          </Link>
        ),
      },
      {
        id: "client",
        header: "Cliente",
        accessorFn: (row) => row.client.name,
      },
      {
        id: "company",
        header: "Compañía",
        accessorFn: (row) =>
          row.companyId ? (companyName.get(row.companyId) ?? "—") : "—",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ getValue }) => (
          <PolicyStatusBadge status={getValue<string>()} />
        ),
        filterFn: "equalsString",
      },
      {
        id: "premium",
        header: "Prima neta",
        accessorFn: (row) => row.premiumNet ?? 0,
        cell: ({ row }) =>
          row.original.premiumNet !== null
            ? formatMoney(
                row.original.premiumNet,
                row.original.currency as CurrencyCode,
              )
            : "—",
      },
      {
        id: "expiry",
        header: "Vencimiento",
        accessorFn: (row) => row.daysToExpiry ?? 99999,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {formatDate(row.original.endDate)}
            </span>
            <PolicyRenewalBadge
              level={row.original.renewalLevel}
              days={row.original.daysToExpiry}
            />
          </div>
        ),
      },
    ],
    [companyName],
  );

  const table = useReactTable({
    data: policies,
    columns,
    state: { globalFilter, columnFilters },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 12 } },
  });

  const statusFilter =
    (table.getColumn("status")?.getFilterValue() as string) ?? "all";
  const filteredRows = table.getFilteredRowModel().rows;

  function exportCsv() {
    const header = [
      "Número",
      "Cliente",
      "Compañía",
      "Estado",
      "Prima neta",
      "Moneda",
      "Inicio",
      "Término",
    ];
    const lines = filteredRows.map((row) => {
      const p = row.original;
      return [
        p.policyNumber,
        p.client.name,
        p.companyId ? (companyName.get(p.companyId) ?? "") : "",
        POLICY_STATUS_LABELS[p.status as PolicyStatusValue] ?? p.status,
        p.premiumNet ?? "",
        p.currency,
        formatDate(p.startDate),
        formatDate(p.endDate),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([`﻿${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `polizas-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Filtrar pólizas…"
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) =>
            table
              .getColumn("status")
              ?.setFilterValue(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {POLICY_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {POLICY_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={exportCsv}
          disabled={filteredRows.length === 0}
        >
          <Download />
          Exportar
        </Button>
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
                  No hay pólizas que coincidan con el filtro.
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
          {filteredRows.length === 1 ? "póliza" : "pólizas"}
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
