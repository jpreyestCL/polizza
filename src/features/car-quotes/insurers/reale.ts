import "server-only";
import { createSimulatedAdapter } from "./simulated";

/** Reale Seguros — reemplazar por scraper real. */
export const realeAdapter = createSimulatedAdapter("reale", "Reale Seguros");
