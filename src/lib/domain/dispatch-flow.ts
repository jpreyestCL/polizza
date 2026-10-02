/** Cola de despacho: pendiente al recepcionar, enviada al despachar. */

export function nextDispatchStatus(
  current: string | null,
  event: "queue" | "send",
): "PENDIENTE" | "ENVIADO" | null {
  if (event === "queue") {
    if (current == null) return "PENDIENTE";
    return null;
  }
  if (current === "PENDIENTE") return "ENVIADO";
  return null;
}
