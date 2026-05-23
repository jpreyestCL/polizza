import "server-only";
import { createSimulatedAdapter } from "./simulated";

/** Chubb Seguros — reemplazar por scraper real. */
export const chubbAdapter = createSimulatedAdapter("chubb", "Chubb Seguros");
