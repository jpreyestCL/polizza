/** Las acciones sensibles exigen un motivo de al menos 10 caracteres. */

export function sensitiveReasonError(reason: string | null | undefined): string | null {
  const text = reason?.trim() ?? "";
  if (text.length < 10) {
    return "El motivo debe tener al menos 10 caracteres.";
  }
  return null;
}
