"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Plus, Users, X } from "lucide-react";
import { formatRut } from "@/lib/rut";
import {
  addClientToHoldingAction,
  removeClientFromHoldingAction,
} from "../actions";
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MemberClient = {
  id: string;
  name: string;
  rut: string;
  type: string;
  status: string;
};

export function HoldingClientsPanel({
  holdingId,
  clients,
  availableClients,
}: {
  holdingId: string;
  clients: MemberClient[];
  availableClients: { id: string; name: string; rut: string }[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function add() {
    if (!selected) return;
    setBusy("add");
    const result = await addClientToHoldingAction(holdingId, selected);
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Cliente agregado al holding");
    setAddOpen(false);
    setSelected("");
    router.refresh();
  }

  async function remove(clientId: string) {
    setBusy(clientId);
    const result = await removeClientFromHoldingAction(clientId);
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Cliente retirado del holding");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Clientes del holding ({clients.length})
        </h2>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setSelected("");
            setAddOpen(true);
          }}
          disabled={availableClients.length === 0}
        >
          <Plus />
          Agregar cliente
        </Button>
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin clientes"
          description="Agrega clientes para agruparlos en este holding."
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {clients.map((client) => (
            <li
              key={client.id}
              className="flex items-center justify-between gap-3 p-3.5"
            >
              <div className="min-w-0">
                <Link
                  href={`/clientes/${client.id}`}
                  className="font-medium hover:text-primary"
                >
                  {client.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {formatRut(client.rut)} ·{" "}
                  {client.type === "EMPRESA" ? "Empresa" : "Persona"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ClientStatusBadge status={client.status} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Quitar del holding"
                  disabled={busy === client.id}
                  onClick={() => remove(client.id)}
                >
                  {busy === client.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <X className="text-muted-foreground" />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar cliente al holding</DialogTitle>
            <DialogDescription>
              Solo se listan clientes que aún no pertenecen a un holding.
            </DialogDescription>
          </DialogHeader>
          {availableClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay clientes disponibles para agregar.
            </p>
          ) : (
            <Select value={selected || undefined} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent>
                {availableClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} · {formatRut(client.rut)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAddOpen(false)}
              disabled={busy === "add"}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={add}
              disabled={!selected || busy === "add"}
            >
              {busy === "add" && <Loader2 className="animate-spin" />}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
