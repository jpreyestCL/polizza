/**
 * Partes del movimiento 0 a partir de la prima ya guardada en la póliza.
 * Si hay desglose en cero pero la neta no, manda la neta: si no, el libro
 * quedaría vacío y el endoso siguiente reemplazaría la prima original.
 */
export function issuePartsFromStored(input: {
  affected: number | null;
  exempt: number | null;
  net: number;
}): { affected: number; exempt: number } | null {
  const hasSplit = input.affected != null || input.exempt != null;
  let affected = hasSplit ? (input.affected ?? 0) : input.net;
  let exempt = hasSplit ? (input.exempt ?? 0) : 0;
  if (affected === 0 && exempt === 0 && input.net !== 0) {
    affected = input.net;
    exempt = 0;
  }
  if (affected === 0 && exempt === 0) return null;
  return { affected, exempt };
}
