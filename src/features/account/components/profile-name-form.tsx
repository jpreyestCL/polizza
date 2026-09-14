"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateProfileNameAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileNameForm({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);

  const dirty = name.trim() !== initialName.trim();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProfileNameAction({ name });
      if (res.ok) {
        toast.success("Nombre actualizado");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5 rounded-lg border p-5">
      <div className="space-y-1">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={80}
          required
          className="max-w-md"
        />
        <p className="text-xs text-muted-foreground">
          Es el nombre con el que apareces en propuestas, bitácoras y
          asignaciones de cartera.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" value={email} disabled className="max-w-md" />
        <p className="text-xs text-muted-foreground">
          El correo es tu identificador de acceso y no se puede cambiar desde
          aquí. Pídeselo a un administrador de tu corredora.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
