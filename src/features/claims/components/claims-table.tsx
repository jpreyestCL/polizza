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
import type { ClaimListItem } from "../queries";
import {
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
  type ClaimStatusValue,
} from "../schemas";
import { ClaimStatusBadge } from "./claim-badges";
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

export function ClaimsTable({ claims }: { claims: ClaimListItem[] }) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const columns = useMemo<ColumnDef<ClaimListItem>[]>(
    () => [
      {
        accessorKey: "claimNumber",
        header: "Carpeta",
        cell: ({ row }) => (
          <Link
            href={`/siniestros/${row.original.id}`}
            className="font-medium hover:text-primary"
          >
            {row.original.claimNumber}
          </Link>
        ),
      },
      {
        id: "client",
        header: "Cliente",
        accessorFn: (row) => row.client.name,
        cell: ({ row }) => (
          <Link
            href={`/clientes/${row.original.client.id}`}
            className="hover:text-primary"
          >
            {row.original.client.name}
          </Link>
        ),
      },
      {
        id: "policy",
        header: "Póliza",
        accessorFn: (row) => row.policy?.policyNumber ?? "",
        cell: ({ row }) =>
          row.original.policy ? (
            <Link
              href={`/polizas/${row.original.policy.id}`}
              className="hover:text-primary"
            >
              {row.original.policy.policyNumber}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "ramo",
        header: "Ramo",
        accessorFn: (row) => row.branchTypeName ?? "",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.branchTypeName ?? "—"}
          </span>
        ),
      },
      {
        id: "company",
        header: "N° compañía",
        accessorFn: (row) => row.companyClaimNumber ?? "",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.companyClaimNumber ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ getValue }) => (
          <ClaimStatusBadge status={getValue<string>()} />
        ),
        filterFn: "equalsString",
      },
      {
        accessorKey: "occurredAt",
        header: "Ocurrido",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {formatDate(getValue<Date | null>())}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: claims,
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
      "Carpeta",
      "Cliente",
      "Póliza",
      "Ramo",
      "N° compañía",
      "Estado",
      "Monto estimado",
      "Monto liquidado",
      "Moneda",
      "Ocurrido",
    ];
    const lines = filteredRows.map((row) => {
      const c = row.original;
      return [
        c.claimNumber,
        c.client.name,
        c.policy?.policyNumber ?? "",
        c.branchTypeName ?? "",
        c.companyClaimNumber ?? "",
        CLAIM_STATUS_LABELS[c.status as ClaimStatusValue] ?? c.status,
        c.estimatedAmount ?? "",
        c.settledAmount ?? "",
        c.currency,
        formatDate(c.occurredAt),
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
    link.download = `siniestros-${new Date().toISOString().slice(0, 10)}.csv`;
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
            placeholder="Filtrar siniestros…"
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
            {CLAIM_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {CLAIM_STATUS_LABELS[status]}
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
                  No hay siniestros que coincidan con el filtro.
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
          {filteredRows.length === 1 ? "siniestro" : "siniestros"}
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
