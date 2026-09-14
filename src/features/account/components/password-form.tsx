"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changePasswordAction } from "../actions";
import { MIN_PASSWORD_LENGTH } from "../schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const EMPTY = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function PasswordForm() {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(EMPTY);
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);

  const mismatch =
    values.confirmPassword.length > 0 &&
    values.newPassword !== values.confirmPassword;
  const tooShort =
    values.newPassword.length > 0 &&
    values.newPassword.length < MIN_PASSWORD_LENGTH;

  function set(field: keyof typeof EMPTY, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await changePasswordAction({
        ...values,
        revokeOtherSessions,
      });
      if (res.ok) {
        setValues(EMPTY);
        toast.success("Contraseña actualizada", {
          description: revokeOtherSessions
            ? "Se cerró la sesión en tus otros dispositivos."
            : undefined,
        });
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5 rounded-lg border p-5">
      <div className="space-y-1">
        <Label htmlFor="currentPassword">Contraseña actual</Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          value={values.currentPassword}
          onChange={(e) => set("currentPassword", e.target.value)}
          required
          className="max-w-md"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="newPassword">Nueva contraseña</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={values.newPassword}
          onChange={(e) => set("newPassword", e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          className="max-w-md"
        />
        <p
          className={
            tooShort ? "text-xs text-destructive" : "text-xs text-muted-foreground"
          }
        >
          Mínimo {MIN_PASSWORD_LENGTH} caracteres.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="confirmPassword">Repite la nueva contraseña</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(e) => set("confirmPassword", e.target.value)}
          required
          aria-invalid={mismatch}
          className="max-w-md"
        />
        {mismatch && (
          <p className="text-xs text-destructive">
            Las contraseñas no coinciden.
          </p>
        )}
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="revokeOtherSessions"
          checked={revokeOtherSessions}
          onCheckedChange={(v) => setRevokeOtherSessions(v === true)}
        />
        <div className="space-y-0.5">
          <Label htmlFor="revokeOtherSessions" className="font-normal">
            Cerrar sesión en mis otros dispositivos
          </Label>
          <p className="text-xs text-muted-foreground">
            Recomendado si sospechas que alguien más conoce tu contraseña.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || mismatch || tooShort}>
          {pending ? "Cambiando…" : "Cambiar contraseña"}
        </Button>
      </div>
    </form>
  );
}
