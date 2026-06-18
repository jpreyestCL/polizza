"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Download, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { formatProposalNumber } from "@/lib/proposal-number";
import type { ProposalListItem } from "../queries";
import type { CatalogItem } from "@/features/catalog/queries";
import {
  PROPOSAL_STATUSES,
  STATUS_LABELS,
  type ProposalStatusValue,
} from "../schemas";
import { ProposalStatusBadge, ProposalSlaBadge } from "./proposal-badges";
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

export function ProposalsTable({
  proposals,
  companies,
}: {
  proposals: ProposalListItem[];
  companies: CatalogItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlQuery = searchParams.get("q") ?? "";
  const statusFilter = searchParams.get("status") ?? "all";
  const companyFilter = searchParams.get("company") ?? "all";

  // Aplica cambios de filtro a la URL (server-side). Resetea el cursor para
  // volver a la primera página cada vez que cambia un filtro.
  const applyParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    params.delete("cursor");
    params.delete("dir");
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  // Input de texto controlado localmente + debounce hacia la URL.
  const [search, setSearch] = useState(urlQuery);
  useEffect(() => {
    setSearch(urlQuery);
  }, [urlQuery]);
  useEffect(() => {
    if (search === urlQuery) return;
    const timer = setTimeout(() => applyParams({ q: search || null }), 350);
    return () => clearTimeout(timer);
    // applyParams/urlQuery se recalculan por render; el disparo lo controla `search`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const companyName = useMemo(
    () => new Map(companies.map((c) => [c.id, c.name])),
    [companies],
  );

  const columns = useMemo<ColumnDef<ProposalListItem>[]>(
    () => [
      {
        accessorKey: "proposalNumber",
        header: "Número",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <Link
              href={`/propuestas/${row.original.id}`}
              className="font-medium hover:text-primary"
            >
              {formatProposalNumber(row.original.proposalNumber)}
            </Link>
            {row.original.policyNumberGenerated && (
              <div className="text-xs font-medium text-success">
                Póliza N° {row.original.policyNumberGenerated}
              </div>
            )}
          </div>
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
          <ProposalStatusBadge status={getValue<string>()} />
        ),
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
        id: "sla",
        header: "En estado",
        accessorFn: (row) => row.daysInState,
        cell: ({ row }) => (
          <ProposalSlaBadge
            level={row.original.slaLevel}
            days={row.original.daysInState}
          />
        ),
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
    [companyName],
  );

  const table = useReactTable({
    data: proposals,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  function exportCsv() {
    const header = [
      "Número",
      "Cliente",
      "Compañía",
      "Estado",
      "Prima neta",
      "Moneda",
      "Creada",
    ];
    const lines = proposals.map((p) =>
      [
        formatProposalNumber(p.proposalNumber),
        p.client.name,
        p.companyId ? (companyName.get(p.companyId) ?? "") : "",
        STATUS_LABELS[p.status as ProposalStatusValue] ?? p.status,
        p.premiumNet ?? "",
        p.currency,
        formatDate(p.createdAt),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([`﻿${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `propuestas-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por número o cliente…"
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) =>
            applyParams({ status: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="sm:w-52">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {PROPOSAL_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={companyFilter}
          onValueChange={(value) =>
            applyParams({ company: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="sm:w-52">
            <SelectValue placeholder="Compañía" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las compañías</SelectItem>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={exportCsv}
          disabled={proposals.length === 0}
        >
          <Download />
          Exportar
        </Button>
      </div>

      <div
        className="rounded-xl border bg-card transition-opacity"
        style={{ opacity: isPending ? 0.6 : 1 }}
      >
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
                  No hay propuestas que coincidan con el filtro.
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
    </div>
  );
}
