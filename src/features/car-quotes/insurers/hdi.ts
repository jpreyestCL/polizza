import "server-only";
import { createSimulatedAdapter } from "./simulated";

/** HDI Seguros — reemplazar por scraper real. */
export const hdiAdapter = createSimulatedAdapter("hdi", "HDI Seguros");
