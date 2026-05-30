import "server-only";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Almacenamiento de archivos subidos al servidor (droplet). En staging el
 * directorio vive fuera del build standalone para sobrevivir a los deploys —
 * se controla con la env `UPLOADS_DIR`. Por defecto `<cwd>/uploads`.
 *
 * Los archivos NO se sirven directamente por nginx: se entregan vía el route
 * handler `/api/documents/[id]/download`, que valida tenant + sesión.
 */
export function uploadsRoot(): string {
  const dir = process.env.UPLOADS_DIR?.trim();
  return dir && dir.length > 0
    ? path.resolve(dir)
    : path.join(process.cwd(), "uploads");
}

/** Extensiones permitidas para documentos de propuesta/póliza (doc cliente). */
export const ALLOWED_DOC_EXTENSIONS = [
  ".ppt",
  ".pptx",
  ".pdf",
  ".xls",
  ".xlsx",
  ".txt",
  ".doc",
  ".docx",
  ".jpg",
  ".jpeg",
  ".gif",
  ".png",
  ".zip",
  ".rar",
  ".msg",
  ".eml",
] as const;

/** Tamaño máximo por archivo (25 MB). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function getExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return ext;
}

export function isAllowedExtension(fileName: string): boolean {
  return (ALLOWED_DOC_EXTENSIONS as readonly string[]).includes(
    getExtension(fileName),
  );
}

/** Sanitiza el nombre original para usarlo en la metadata (no en disco). */
export function sanitizeFileName(name: string): string {
  return name.replace(/[\r\n\t]/g, " ").replace(/[/\\]/g, "_").trim().slice(0, 200);
}

/**
 * Guarda un archivo en disco bajo `<uploadsRoot>/<organizationId>/<key>`.
 * Devuelve la `storageKey` relativa (incluye el segmento de organización) para
 * persistir en `Document.storageKey`.
 */
export async function saveUploadedFile(
  organizationId: string,
  fileName: string,
  bytes: Buffer,
): Promise<{ storageKey: string }> {
  const ext = getExtension(fileName);
  const random = crypto.randomBytes(12).toString("hex");
  const safeOrg = organizationId.replace(/[^a-zA-Z0-9_-]/g, "");
  const storageKey = path.posix.join(safeOrg, `${Date.now()}-${random}${ext}`);
  const absDir = path.join(uploadsRoot(), safeOrg);
  await mkdir(absDir, { recursive: true });
  await writeFile(path.join(uploadsRoot(), storageKey), bytes);
  return { storageKey };
}

/** Resuelve la ruta absoluta de una storageKey, validando que no escape el root. */
export function resolveStoragePath(storageKey: string): string | null {
  const root = uploadsRoot();
  const abs = path.resolve(root, storageKey);
  // Previene path traversal: el resultado debe quedar dentro del root.
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

export async function readStoredFile(storageKey: string): Promise<Buffer | null> {
  const abs = resolveStoragePath(storageKey);
  if (!abs) return null;
  try {
    return await readFile(abs);
  } catch {
    return null;
  }
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  const abs = resolveStoragePath(storageKey);
  if (!abs) return;
  try {
    await unlink(abs);
  } catch {
    // Si el archivo ya no existe, no es un error fatal.
  }
}
