"use client";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // En producción Next oculta el mensaje del servidor; en desarrollo llega.
  const forbidden = error.message.includes("Tu rol no permite");
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold">No se pudo completar la acción</h2>
      <p className="text-sm text-muted-foreground">
        {forbidden
          ? error.message
          : "Puede que tu rol no permita modificar este dato (solo lectura, cobranza, siniestros o finanzas) o que haya ocurrido un error. Si crees que deberías poder hacerlo, pide a un administrador que revise tu rol."}
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">Código: {error.digest}</p>
      ) : null}
      <Button onClick={reset}>Volver a intentar</Button>
    </div>
  );
}
