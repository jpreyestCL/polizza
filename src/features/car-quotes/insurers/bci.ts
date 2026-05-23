import "server-only";
import { createSimulatedAdapter } from "./simulated";

/**
 * BCI Seguros — adaptador.
 * Hoy usa el factory simulado. Reemplazar por un scraper real (Playwright)
 * contra el portal de cotizaciones de BCI cuando se tengan credenciales y
 * acceso. Mantener el mismo `key` y el mismo contrato `InsurerAdapter`.
 */
export const bciAdapter = createSimulatedAdapter("bci", "BCI Seguros");
