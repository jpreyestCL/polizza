"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  User,
} from "lucide-react";
import { formatRut } from "@/lib/rut";
import type { ClientListItem } from "../queries";
import type { OrgMember } from "../queries";
import { ClientStatusBadge } from "./client-status-badge";
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

const TYPE_LABELS: Record<string, string> = {
  PERSONA: "Persona",
  EMPRESA: "Empresa",
};
const STATUS_LABELS: Record<string, string> = {
  PROSPECTO: "Prospecto",
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
};

function downloadCsv(rows: ClientListItem[], nameByUser: Map<string, string>) {
  const header = [
    "Nombre",
    "Tipo",
    "RUT",
    "Estado",
    "Correo",
    "Teléfono",
    "Región",
    "Comuna",
    "Ejecutivo",
  ];
  const lines = rows.map((c) =>
    [
      c.name,
      TYPE_LABELS[c.type] ?? c.type,
      formatRut(c.rut),
      STATUS_LABELS[c.status] ?? c.status,
      c.email ?? "",
      c.phone ?? "",
      c.region ?? "",
      c.commune ?? "",
      c.assignedUserId ? (nameByUser.get(c.assignedUserId) ?? "") : "",
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ClientsTable({
  clients,
  members,
}: {
  clients: ClientListItem[];
  members: OrgMember[];
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  const nameByUser = useMemo(
    () => new Map(members.map((m) => [m.userId, m.name])),
    [members],
  );

  const columns = useMemo<ColumnDef<ClientListItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Cliente
            <ArrowUpDown className="size-3" />
          </button>
        ),
        cell: ({ row }) => (
          <Link
            href={`/clientes/${row.original.id}`}
            className="flex items-center gap-2 font-medium hover:text-primary"
          >
            {row.original.type === "EMPRESA" ? (
              <Building2 className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <User className="size-4 shrink-0 text-muted-foreground" />
            )}
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "type",
        header: "Tipo",
        cell: ({ getValue }) => TYPE_LABELS[getValue<string>()] ?? "—",
        filterFn: "equalsString",
      },
      {
        accessorKey: "rut",
        header: "RUT",
        cell: ({ getValue }) => formatRut(getValue<string>()),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ getValue }) => (
          <ClientStatusBadge status={getValue<string>()} />
        ),
        filterFn: "equalsString",
      },
      {
        id: "assignee",
        header: "Ejecutivo",
        accessorFn: (row) =>
          row.assignedUserId
            ? (nameByUser.get(row.assignedUserId) ?? "—")
            : "—",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<string>()}</span>
        ),
      },
      {
        id: "location",
        header: "Ubicación",
        accessorFn: (row) =>
          [row.commune, row.region].filter(Boolean).join(", ") || "—",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<string>()}</span>
        ),
      },
      {
        id: "contacts",
        header: "Contactos",
        accessorFn: (row) => row._count.contacts,
        cell: ({ getValue }) => getValue<number>(),
      },
    ],
    [nameByUser],
  );

  const table = useReactTable({
    data: clients,
    columns,
    state: { globalFilter, columnFilters, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 12 } },
  });

  const typeFilter =
    (table.getColumn("type")?.getFilterValue() as string) ?? "all";
  const statusFilter =
    (table.getColumn("status")?.getFilterValue() as string) ?? "all";
  const filteredRows = table.getFilteredRowModel().rows;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Filtrar clientes…"
            className="pl-8"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(value) =>
            table
              .getColumn("type")
              ?.setFilterValue(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="PERSONA">Persona</SelectItem>
            <SelectItem value="EMPRESA">Empresa</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) =>
            table
              .getColumn("status")
              ?.setFilterValue(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="PROSPECTO">Prospecto</SelectItem>
            <SelectItem value="ACTIVO">Activo</SelectItem>
            <SelectItem value="INACTIVO">Inactivo</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            downloadCsv(
              filteredRows.map((r) => r.original),
              nameByUser,
            )
          }
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
                  No hay clientes que coincidan con el filtro.
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
          {filteredRows.length === 1 ? "cliente" : "clientes"}
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
