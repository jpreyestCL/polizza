export function normalizeClientEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLocaleLowerCase("es-CL");
  return normalized || null;
}

export function maskEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const [local, domain] = value.split("@");
  if (!domain) return "••••••";
  return `${local.slice(0, 1)}***@${domain}`;
}

export function maskPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const visible = value.replace(/\s/g, "").slice(-4);
  return `•••• ${visible}`;
}

export function maskAddress(value: string | null | undefined): string | null {
  return value ? "••••••••" : null;
}

export const MASKED_DATE = "••/••/••••";
