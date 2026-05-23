import "server-only";
import type { InsurerAdapter } from "./types";
import { bciAdapter } from "./bci";
import { zurichAdapter } from "./zurich";
import { asporAdapter } from "./aspor";
import { hdiAdapter } from "./hdi";
import { fidAdapter } from "./fid";
import { realeAdapter } from "./reale";
import { suraAdapter } from "./sura";
import { chubbAdapter } from "./chubb";
import { rentaNacionalAdapter } from "./renta-nacional";

/**
 * Registro central de aseguradoras soportadas. El orden aquí es el orden
 * por defecto en la UI. Para sumar una nueva: crear `insurers/<key>.ts` con
 * un adaptador que cumpla `InsurerAdapter` y agregarlo a esta lista.
 */
export const INSURER_ADAPTERS: InsurerAdapter[] = [
  bciAdapter,
  zurichAdapter,
  asporAdapter,
  hdiAdapter,
  fidAdapter,
  realeAdapter,
  suraAdapter,
  chubbAdapter,
  rentaNacionalAdapter,
];

const BY_KEY = new Map(INSURER_ADAPTERS.map((a) => [a.key, a]));

export function getInsurerAdapter(key: string): InsurerAdapter | null {
  return BY_KEY.get(key) ?? null;
}

export function listInsurers(): Array<{ key: string; name: string }> {
  return INSURER_ADAPTERS.map((a) => ({ key: a.key, name: a.name }));
}
