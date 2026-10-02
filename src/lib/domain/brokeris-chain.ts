/**
 * Cadena de renovación de Brokeris (06 §8.4).
 * `renewedFromId` es la póliza madre. `lineageId` es la raíz de la cadena
 * y `termNumber` recorre esa cadena en orden cronológico.
 */

export type RenewalRow = {
  id: string;
  renewedFromId: string | null;
  sortKey: string;
};

export type RenewalAssignment = {
  id: string;
  lineageId: string;
  termNumber: number;
  renewedFromId: string | null;
  needsReview: boolean;
  note: string | null;
};

export function assignRenewalLineage(rows: RenewalRow[]): RenewalAssignment[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const parent = new Map<string, string>();
  for (const row of rows) parent.set(row.id, row.id);

  function find(id: string): string {
    let cursor = id;
    while (parent.get(cursor) !== cursor) {
      const next = parent.get(parent.get(cursor)!)!;
      parent.set(cursor, next);
      cursor = next;
    }
    return cursor;
  }

  function unite(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  }

  const cycle = new Set<string>();
  const missingParent = new Set<string>();

  for (const row of rows) {
    const mother = row.renewedFromId;
    if (!mother) continue;
    if (!byId.has(mother)) {
      missingParent.add(row.id);
      continue;
    }
    const seen = new Set<string>();
    let cursor: string | null = mother;
    while (cursor && byId.has(cursor)) {
      if (cursor === row.id || seen.has(cursor)) {
        cycle.add(row.id);
        break;
      }
      seen.add(cursor);
      cursor = byId.get(cursor)!.renewedFromId;
    }
    unite(row.id, mother);
  }

  const groups = new Map<string, RenewalRow[]>();
  for (const row of rows) {
    const key = find(row.id);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const assigned = new Map<string, RenewalAssignment>();
  for (const list of groups.values()) {
    const ordered = [...list].sort(
      (a, b) => a.sortKey.localeCompare(b.sortKey) || a.id.localeCompare(b.id),
    );
    const lineageId = ordered[0].id;
    const previous = new Map<string, string | null>();
    ordered.forEach((row, index) => {
      previous.set(row.id, index === 0 ? null : ordered[index - 1].id);
    });
    for (const [index, row] of ordered.entries()) {
      const notes: string[] = [];
      if (cycle.has(row.id)) notes.push("Ciclo en la cadena.");
      if (missingParent.has(row.id)) notes.push("La póliza madre no viene en el lote.");
      const expectedMother = previous.get(row.id) ?? null;
      if (
        row.renewedFromId &&
        byId.has(row.renewedFromId) &&
        row.renewedFromId !== expectedMother
      ) {
        notes.push("La madre no es el período anterior en la cadena.");
      }
      assigned.set(row.id, {
        id: row.id,
        lineageId,
        termNumber: index + 1,
        renewedFromId: row.renewedFromId,
        needsReview: notes.length > 0,
        note: notes.length > 0 ? notes.join(" ") : null,
      });
    }
  }

  return rows.map((row) => assigned.get(row.id)!);
}
