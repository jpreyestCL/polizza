"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { requestEmailChangeAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EmailForm({
  currentEmail,
  emailVerified,
}: {
  currentEmail: string;
  emailVerified: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [newEmail, setNewEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await requestEmailChangeAction({ newEmail });
      if (res.ok) {
        setSentTo(newEmail.trim().toLowerCase());
        setNewEmail("");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5 rounded-lg border p-5">
      <div className="space-y-1">
        <Label htmlFor="currentEmail">Correo actual</Label>
        <Input id="currentEmail" value={currentEmail} disabled className="max-w-md" />
        <p className="text-xs text-muted-foreground">
          {emailVerified
            ? "Confirmado. Es tu identificador de acceso."
            : "Sin confirmar. Es tu identificador de acceso y sigue sirviendo para entrar."}
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="newEmail">Correo nuevo</Label>
        <Input
          id="newEmail"
          type="email"
          autoComplete="email"
          placeholder="nombre@corredora.cl"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
          className="max-w-md"
        />
        <p className="text-xs text-muted-foreground">
          Te enviaremos un enlace de confirmación a esa dirección. Tu correo de
          acceso cambia recién cuando abras ese enlace; mientras tanto sigues
          entrando con el actual.
        </p>
      </div>

      {sentTo && (
        <div className="flex gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              Si <span className="font-mono">{sentTo}</span> está disponible, ya
              salió el enlace de confirmación.
            </p>
            <p className="text-muted-foreground">
              Revisa esa bandeja. Si el correo ya pertenece a otra cuenta de
              Polizza, no se envía nada y tu dirección actual no cambia.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || newEmail.trim().length === 0}>
          {pending ? "Enviando…" : "Enviar enlace de confirmación"}
        </Button>
      </div>
    </form>
  );
}
