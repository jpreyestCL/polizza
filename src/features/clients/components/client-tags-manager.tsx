"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createClientTagAction,
  deleteClientTagAction,
  setClientTagAction,
  updateClientTagAction,
} from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tag = { id: string; name: string; color: string };

export function ClientTagsManager({
  clientId,
  tags,
  assignedTagIds,
  canWrite,
}: {
  clientId: string;
  tags: Tag[];
  assignedTagIds: string[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const assigned = new Set(assignedTagIds);

  function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await task();
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-sm font-semibold">Tags</h2>
        {assignedTagIds.length === 0 && (
          <span className="text-xs text-muted-foreground">Sin tags asignados</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <div key={tag.id} className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canWrite || pending}
              onClick={() =>
                run(() => setClientTagAction(clientId, tag.id, !assigned.has(tag.id)))
              }
            >
              <Badge variant={assigned.has(tag.id) ? "default" : "outline"}>
                {tag.name}
              </Badge>
            </button>
            {canWrite && (
              <>
                <button
                  type="button"
                  aria-label={`Renombrar tag ${tag.name}`}
                  className="text-muted-foreground hover:text-foreground"
                  disabled={pending}
                  onClick={() => {
                    const nextName = window.prompt("Nuevo nombre del tag", tag.name);
                    if (nextName && nextName.trim() !== tag.name) {
                      run(() => updateClientTagAction(tag.id, nextName));
                    }
                  }}
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar tag ${tag.name}`}
                  className="text-muted-foreground hover:text-destructive"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`¿Eliminar el tag "${tag.name}"?`)) {
                      run(() => deleteClientTagAction(tag.id));
                    }
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      {canWrite && (
        <form
          className="flex max-w-sm gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            run(async () => {
              const result = await createClientTagAction(name);
              if (result.ok) setName("");
              return result;
            });
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            placeholder="Nuevo tag"
          />
          <Button type="submit" size="sm" disabled={pending || !name.trim()}>
            <Plus />
            Crear
          </Button>
        </form>
      )}
    </section>
  );
}
