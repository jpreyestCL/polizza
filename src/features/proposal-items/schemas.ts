import { z } from "zod";
import type { BranchFieldDef } from "./queries";

const optionalString = z.string().trim().default("");

export const proposalItemSchema = z.object({
  branchTypeId: z.string().min(1, "Ramo requerido"),
  insuredClientId: optionalString,
  beneficiaryClientId: optionalString,
  identification: optionalString,
  glossNote: optionalString,
  // El JSON dinámico de la ficha — validado contra el schema del ramo a parte.
  data: z.record(z.string(), z.unknown()).default({}),
});

export type ProposalItemValues = z.infer<typeof proposalItemSchema>;

/** Valida el `data` contra el `BranchFieldDef[]` del ramo seleccionado. */
export function validateItemData(
  fields: BranchFieldDef[],
  data: Record<string, unknown>,
): { ok: true } | { ok: false; error: string } {
  for (const f of fields) {
    const value = data[f.fieldKey];
    if (f.required && (value === undefined || value === null || value === "")) {
      return { ok: false, error: `Campo requerido: ${f.label}` };
    }
    if (value === undefined || value === null || value === "") continue;
    if (f.type === "number") {
      if (Number.isNaN(Number(value))) {
        return { ok: false, error: `${f.label}: debe ser numérico` };
      }
    }
    if (f.type === "date" && typeof value === "string") {
      if (Number.isNaN(new Date(value).getTime())) {
        return { ok: false, error: `${f.label}: fecha inválida` };
      }
    }
    if (f.type === "select" && f.options) {
      const allowed = f.options.map((o) => o.value);
      if (typeof value !== "string" || !allowed.includes(value)) {
        return {
          ok: false,
          error: `${f.label}: valor fuera de las opciones permitidas`,
        };
      }
    }
  }
  return { ok: true };
}
