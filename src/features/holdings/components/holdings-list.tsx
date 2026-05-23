"use client";

import { useState } from "react";
import Link from "next/link";
import { Layers, Plus } from "lucide-react";
import type { HoldingListItem } from "../queries";
import { HoldingDialog } from "./holding-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export function HoldingsList({
  holdings,
}: {
  holdings: HoldingListItem[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setDialogOpen(true)}>
          <Plus />
          Nuevo holding
        </Button>
      </div>

      {holdings.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Sin holdings"
          description="Crea un holding para agrupar clientes relacionados entre sí."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {holdings.map((holding) => (
            <li key={holding.id}>
              <Link
                href={`/holdings/${holding.id}`}
                className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <p className="flex items-center gap-2 font-medium">
                  <Layers className="size-4 text-muted-foreground" />
                  {holding.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {holding.clientCount}{" "}
                  {holding.clientCount === 1 ? "cliente" : "clientes"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <HoldingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        holding={null}
      />
    </div>
  );
}
