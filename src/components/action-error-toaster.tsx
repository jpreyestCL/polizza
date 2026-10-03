"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Los formularios esperan `{ ok, error }` de la acción; si la acción lanza
 * (por ejemplo, el rol no puede escribir ese dato) la promesa queda sin
 * capturar y el formulario no muestra nada. Esto lo avisa.
 */
export function ActionErrorToaster() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const message =
        event.reason instanceof Error ? event.reason.message : String(event.reason ?? "");
      if (message.includes("NEXT_REDIRECT") || message.includes("NEXT_NOT_FOUND")) return;
      toast.error(
        message.includes("Tu rol no permite")
          ? message
          : "No se pudo guardar. Puede que tu rol no permita modificar este dato; si crees que deberías poder, pide a un administrador que revise tu rol.",
      );
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);
  return null;
}
