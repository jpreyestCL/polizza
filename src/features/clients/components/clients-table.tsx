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
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
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

export function ClientsTable({
  clients,
  members,
  tags,
  branchTypes,
  canExport,
}: {
  clients: ClientListItem[];
  members: OrgMember[];
  tags: { id: string; name: string }[];
  branchTypes: { id: string; name: string }[];
  canExport: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlQuery = searchParams.get("q") ?? "";
  const typeFilter = searchParams.get("type") ?? "all";
  const statusFilter = searchParams.get("status") ?? "all";
  const assigneeFilter = searchParams.get("ejecutivo") ?? "all";
  const branchFilter = searchParams.get("ramo") ?? "all";
  const tagFilter = searchParams.get("tag") ?? "all";
  const sort = searchParams.get("sort");
  const order = searchParams.get("order") === "desc" ? "desc" : "asc";

  // Aplica cambios de filtro a la URL (server-side). Resetea el cursor para
  // volver a la primera página cada vez que cambia un filtro u orden.
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

  const toggleNameSort = () => {
    if (sort !== "name") applyParams({ sort: "name", order: "asc" });
    else if (order === "asc") applyParams({ sort: "name", order: "desc" });
    else applyParams({ sort: null, order: null });
  };

  const nameByUser = useMemo(
    () => new Map(members.map((m) => [m.userId, m.name])),
    [members],
  );

  const columns = useMemo<ColumnDef<ClientListItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => (
          <button
            type="button"
            className="flex items-center gap-1"
            onClick={toggleNameSort}
          >
            Cliente
            {sort === "name" ? (
              order === "asc" ? (
                <ArrowUp className="size-3" />
              ) : (
                <ArrowDown className="size-3" />
              )
            ) : (
              <ArrowUpDown className="size-3" />
            )}
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
        id: "tags",
        header: "Tags",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.tagAssignments.map(({ tag }) => tag.name).join(", ") || "—"}
          </span>
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
    // toggleNameSort/sort/order cambian la cabecera; el resto es estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nameByUser, sort, order],
  );

  const table = useReactTable({
    data: clients,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, RUT o N° de póliza…"
            className="pl-8"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(value) =>
            applyParams({ type: value === "all" ? null : value })
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
            applyParams({ status: value === "all" ? null : value })
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
        <Select
          value={assigneeFilter}
          onValueChange={(value) =>
            applyParams({ ejecutivo: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Ejecutivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los ejecutivos</SelectItem>
            {members.map((member) => (
              <SelectItem key={member.userId} value={member.userId}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={branchFilter}
          onValueChange={(value) =>
            applyParams({ ramo: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Ramo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los ramos</SelectItem>
            {branchTypes.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={tagFilter}
          onValueChange={(value) =>
            applyParams({ tag: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tags</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canExport && (
          <Button asChild variant="outline">
            <a href={`/api/clientes/csv?${searchParams.toString()}`}>
              <Download />
              Exportar
            </a>
          </Button>
        )}
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
    </div>
  );
}
