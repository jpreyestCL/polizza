import { TriangleAlert } from "lucide-react";

/**
 * Banner de alerta de un cliente. Se muestra cuando el cliente tiene un
 * comentario de alerta cargado, en su ficha y en sus propuestas/pólizas.
 */
export function ClientAlertBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
      <div className="space-y-0.5">
        <p className="font-semibold text-foreground">Alerta del cliente</p>
        <p className="whitespace-pre-wrap text-foreground/80">{message}</p>
      </div>
    </div>
  );
}
