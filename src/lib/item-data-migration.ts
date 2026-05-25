/**
 * Migración de `ProposalItem.data` (JSON validado contra BranchFieldSchema).
 *
 * Cuando el SaaS-admin cambia una ficha (renombra un fieldKey, cambia tipo,
 * elimina un campo), las propuestas viejas quedan con datos legacy. Este
 * módulo aplica migraciones forward declaradas por versión.
 *
 * Flujo:
 *   - Cada ProposalItem tiene `dataSchemaVersion` (default 1).
 *   - CURRENT_DATA_SCHEMA_VERSION es la versión actual del código.
 *   - migrateItemData(data, fromVersion) recorre los pasos hasta llegar a
 *     CURRENT y devuelve el data normalizado.
 *   - Las queries llaman migrateItemData al leer. La escritura puede
 *     persistir el resultado migrado (lazy upgrade) opcionalmente.
 */

export const CURRENT_DATA_SCHEMA_VERSION = 1;

export type ItemData = Record<string, unknown>;

type MigrationStep = {
  from: number;
  to: number;
  /** Recibe el data viejo y devuelve el data nuevo. Idempotente. */
  apply: (data: ItemData) => ItemData;
};

/**
 * Pasos de migración. Cuando rompas la forma del JSON:
 *   1. Subí CURRENT_DATA_SCHEMA_VERSION.
 *   2. Agregá un step { from: N, to: N+1, apply: ... }.
 *   3. NO modifiques steps históricos: son idempotentes y se aplican siempre.
 *
 * Ejemplo (cuando exista):
 *   { from: 1, to: 2, apply: (d) => {
 *       const out = { ...d };
 *       if ("patente" in out) {
 *         out.licensePlate = out.patente;
 *         delete out.patente;
 *       }
 *       return out;
 *     }},
 */
const MIGRATIONS: MigrationStep[] = [];

/**
 * Aplica las migraciones desde `fromVersion` hasta la actual.
 * Si fromVersion >= actual o data inválido, devuelve data sin tocar.
 */
export function migrateItemData(
  data: unknown,
  fromVersion: number | null | undefined,
): { data: ItemData; version: number; migrated: boolean } {
  const safe: ItemData =
    data && typeof data === "object" && !Array.isArray(data)
      ? { ...(data as ItemData) }
      : {};
  const start = fromVersion ?? 1;
  if (start >= CURRENT_DATA_SCHEMA_VERSION) {
    return { data: safe, version: start, migrated: false };
  }
  let current = safe;
  let version = start;
  for (const step of MIGRATIONS) {
    if (step.from === version && step.to > version) {
      current = step.apply(current);
      version = step.to;
    }
  }
  return {
    data: current,
    version,
    migrated: version !== start,
  };
}

/** Helper para migrar una lista (útil al leer ProposalItem[]). */
export function migrateItemDataList<T extends { data: unknown; dataSchemaVersion: number | null }>(
  items: T[],
): Array<T & { data: ItemData; dataSchemaVersion: number }> {
  return items.map((item) => {
    const result = migrateItemData(item.data, item.dataSchemaVersion);
    return {
      ...item,
      data: result.data,
      dataSchemaVersion: result.version,
    };
  });
}
