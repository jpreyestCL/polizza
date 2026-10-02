import { cleanRut } from "@/lib/rut";
import { parseDeductible } from "@/lib/domain/deductible";

export type RutRow = { id: string; rut: string; policyCount: number };

/** L1. Agrupa por RUT normalizado y se queda con la ficha que tiene más pólizas. */
export function mergeRutGroups(rows: RutRow[]): {
  rut: string;
  keepId: string;
  dropIds: string[];
}[] {
  const groups = new Map<string, RutRow[]>();
  for (const row of rows) {
    const rut = cleanRut(row.rut);
    const list = groups.get(rut) ?? [];
    list.push(row);
    groups.set(rut, list);
  }
  const merges: { rut: string; keepId: string; dropIds: string[] }[] = [];
  for (const [rut, list] of groups) {
    if (list.length < 2) continue;
    const ranked = [...list].sort(
      (a, b) => b.policyCount - a.policyCount || a.id.localeCompare(b.id),
    );
    merges.push({
      rut,
      keepId: ranked[0].id,
      dropIds: ranked.slice(1).map((row) => row.id),
    });
  }
  return merges;
}

/** L2. RUT bajo 50 millones marcado como empresa se propone persona. */
export function suggestNaturalPerson(rut: string, type: string): boolean {
  const numeric = Number(cleanRut(rut).slice(0, -1));
  return type === "EMPRESA" && Number.isFinite(numeric) && numeric < 50_000_000;
}

const COMMUNES = [
  "santiago",
  "providencia",
  "las condes",
  "vitacura",
  "nunoa",
  "la reina",
  "maipu",
  "puente alto",
  "san bernardo",
  "valparaiso",
  "vina del mar",
  "concepcion",
  "talcahuano",
  "temuco",
  "puerto montt",
  "antofagasta",
  "la serena",
  "rancagua",
  "talca",
  "chillan",
  "iquique",
  "arica",
  "punta arenas",
  "osorno",
  "valdivia",
  "coyhaique",
];

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** L3. Sin coincidencia con el listado, la comuna queda para revisar. */
export function mapCommune(raw: string): { commune: string | null; needsReview: boolean } {
  const key = fold(raw);
  if (!key) return { commune: null, needsReview: true };
  const hit = COMMUNES.find((name) => name === key);
  if (!hit) return { commune: null, needsReview: true };
  return { commune: hit, needsReview: false };
}

/** L4. Teléfono chileno a E.164. Lo que no calza se deja como nota. */
export function cleanPhone(raw: string): { e164: string | null; note: string | null } {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("56")) {
    return { e164: `+${digits}`, note: null };
  }
  if (digits.length === 9) {
    return { e164: `+56${digits}`, note: null };
  }
  const trimmed = raw.trim();
  return { e164: null, note: trimmed || null };
}

/** L6. El ramo de prueba no se migra. */
export function skipBranch(name: string): boolean {
  return fold(name) === "prueba";
}

/** L7. Un tipo de cambio más de 100 veces la UF del día se divide por 100. */
export function correctStoredFx(
  value: number,
  ufOfDay: number,
): { value: number; corrected: boolean } {
  if (ufOfDay > 0 && value > ufOfDay * 100) {
    return { value: value / 100, corrected: true };
  }
  return { value, corrected: false };
}

/** L8. Las variantes de dólar quedan en USD. */
export function unifyCurrency(code: string): string {
  const key = fold(code).replace(/\s/g, "");
  if (["us$", "usd", "us", "dolar", "dolarobservado", "usdobs"].includes(key)) {
    return "USD";
  }
  if (key === "clf" || key === "uf") return "UF";
  return code.trim().toUpperCase();
}

/** L9. El texto original se conserva y se estructura si el patrón es claro. */
export function cleanDeductible(text: string) {
  const parsed = parseDeductible(text);
  return {
    sourceText: text,
    ...parsed,
    needsReview: parsed.amount == null && parsed.pct == null && text.trim() !== "" && text.trim() !== "-",
  };
}

export type GhostChoice = "A" | "B" | "C" | "D";

/**
 * L10. La dueña elige por grupo. D, el defecto, deja la cuota pendiente.
 */
export function ghostInstallmentAction(input: {
  method: string;
  policyEnded: boolean;
  daysOverdue: number;
  choice: GhostChoice;
}): "PAID" | "PRESUMED_PAID" | "CANCELLED" | "PENDING" {
  const pac = input.method === "PAC" || input.method === "PAT";
  if (input.choice === "A" && pac && input.policyEnded) return "PAID";
  if (input.choice === "B" && pac && !input.policyEnded && input.daysOverdue > 60) {
    return "PRESUMED_PAID";
  }
  if (input.choice === "C" && input.policyEnded) return "CANCELLED";
  return "PENDING";
}

/** L11. Un plan de una póliza terminada tiene que cerrarse. */
export function planCloseForStatus(
  status: string,
): "CLOSED_BY_CANCELLATION" | "CLOSED_BY_ANNULMENT" | null {
  if (status === "CANCELADA") return "CLOSED_BY_CANCELLATION";
  if (status === "ANULADA") return "CLOSED_BY_ANNULMENT";
  return null;
}

/** L12. Una renovación vencida sin gestión se marca, no se inventa una decisión. */
export function unmanagedRenewal(endDate: Date, today: Date, managed: boolean): boolean {
  return !managed && endDate.getTime() < today.getTime();
}

/** L13. De la cuenta o tarjeta solo quedan los últimos 4 dígitos. */
export function maskAccount(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(-4);
}

/** L14. Un atributo que no valida se migra marcado, con el valor original. */
export function legacyAttribute(valid: boolean, value: unknown) {
  if (valid) return { needsReview: false as const };
  return { needsReview: true as const, legacy: value };
}

/** L15. Un subestado desconocido no se pierde: queda como nota. */
export function mapClaimSubstatus(
  code: string,
  known: Record<string, string>,
): { status: string; note: string | null } {
  const mapped = known[code];
  if (mapped) return { status: mapped, note: null };
  return { status: "REPORTED", note: `Subestado sin mapa: ${code}` };
}

/** L16. La fecha del hecho se conserva. La de registro es la de la migración. */
export function migrationLogTimes(occurredAt: Date, migratedAt: Date) {
  return { occurredAt, recordedAt: migratedAt };
}
