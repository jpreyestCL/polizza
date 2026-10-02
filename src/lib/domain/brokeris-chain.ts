/**
 * Cadena de renovación de Brokeris (06 §8.4).
 * La raíz es el extremo de `renewedFromId`. El período numera las fechas
 * reconocidas (ISO o dd-mm-aaaa). Una vigencia vacía no se adelanta a la raíz.
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

export function parseVigencia(value: string): number | null {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return utcDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const local = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(trimmed);
  if (local) return utcDay(Number(local[3]), Number(local[2]), Number(local[1]));
  return null;
}

function utcDay(year: number, month: number, day: number): number | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return time;
}

function compareRows(a: RenewalRow, b: RenewalRow): number {
  const left = parseVigencia(a.sortKey);
  const right = parseVigencia(b.sortKey);
  if (left != null && right != null && left !== right) return left - right;
  if (left == null && right != null) return 1;
  if (left != null && right == null) return -1;
  return a.id.localeCompare(b.id);
}

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

  for (const row of rows) {
    const mother = row.renewedFromId;
    if (!mother || mother === row.id) continue;
    if (byId.has(mother)) {
      unite(row.id, mother);
      continue;
    }
    const virtual = `missing:${mother}`;
    if (!parent.has(virtual)) parent.set(virtual, virtual);
    unite(row.id, virtual);
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
    const ids = new Set(list.map((row) => row.id));
    const inSetRoots = list.filter((row) => !row.renewedFromId);
    const missingMothers = new Set<string>();
    for (const row of list) {
      if (row.renewedFromId && row.renewedFromId !== row.id && !ids.has(row.renewedFromId)) {
        missingMothers.add(row.renewedFromId);
      }
    }
    const cycle = inSetRoots.length === 0 && missingMothers.size === 0;
    const lineageId =
      inSetRoots.length === 1
        ? inSetRoots[0].id
        : missingMothers.size === 1
          ? [...missingMothers][0]
          : [...list].sort((a, b) => a.id.localeCompare(b.id))[0].id;
    const ordered = [...list].sort(compareRows);
    const previous = new Map<string, string | null>();
    ordered.forEach((row, index) => {
      previous.set(row.id, index === 0 ? null : ordered[index - 1].id);
    });
    for (const [index, row] of ordered.entries()) {
      const notes: string[] = [];
      if (cycle || row.renewedFromId === row.id) notes.push("Ciclo en la cadena.");
      if (row.renewedFromId && !ids.has(row.renewedFromId)) {
        notes.push("La póliza madre no viene en el lote.");
      }
      if (parseVigencia(row.sortKey) == null) notes.push("Vigencia vacía o no reconocida.");
      const expectedMother = previous.get(row.id) ?? null;
      if (
        row.renewedFromId &&
        ids.has(row.renewedFromId) &&
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
