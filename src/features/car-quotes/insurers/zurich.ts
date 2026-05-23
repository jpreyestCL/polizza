import "server-only";
import { createSimulatedAdapter } from "./simulated";

/** Zurich — reemplazar por scraper real del portal Zurich. */
export const zurichAdapter = createSimulatedAdapter("zurich", "Zurich Seguros");
