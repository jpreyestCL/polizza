import "server-only";
import { createSimulatedAdapter } from "./simulated";

/** Renta Nacional Seguros — reemplazar por scraper real. */
export const rentaNacionalAdapter = createSimulatedAdapter(
  "renta-nacional",
  "Renta Nacional Seguros",
);
