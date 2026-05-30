"use server";

import { revalidatePath } from "next/cache";
import { requireOrgDb } from "@/server/context";
import { logActivity } from "@/server/activity";
import {
  isAllowedExtension,
  saveUploadedFile,
  deleteStoredFile,
  sanitizeFileName,
  MAX_UPLOAD_BYTES,
  ALLOWED_DOC_EXTENSIONS,
} from "@/server/storage";
import { documentFormSchema, type DocumentEntity } from "./schemas";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function entityPath(entityType: DocumentEntity, entityId: string): string {
  if (entityType === "CLIENT") return `/clientes/${entityId}`;
  if (entityType === "PROPOSAL") return `/propuestas/${entityId}`;
  if (entityType === "CLAIM") return `/siniestros/${entityId}`;
  if (entityType === "CAR_QUOTATION") return `/cotizaciones/${entityId}`;
  return `/polizas/${entityId}`;
}

export async function addDocumentAction(
  entityType: DocumentEntity,
  entityId: string,
  values: { fileName: string; fileUrl: string; documentType: string },
): Promise<ActionResult> {
  const parsed = documentFormSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const document = await db.document.create({
    data: {
      organizationId: ctx.organizationId,
      entityType,
      entityId,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      documentType: data.documentType.trim() || null,
      uploadedById: ctx.userId,
    },
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType,
    entityId,
    action: "document_added",
    summary: `Documento agregado: ${data.fileName}`,
    userId: ctx.userId,
  });

  revalidatePath(entityPath(entityType, entityId));
  return { ok: true, id: document.id };
}

/**
 * Sube un archivo real al servidor y lo registra como Document. Valida
 * extensión y tamaño. El archivo se guarda en disco (ver `@/server/storage`)
 * y se entrega luego vía `/api/documents/[id]/download`.
 */
export async function uploadDocumentAction(
  entityType: DocumentEntity,
  entityId: string,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get("file");
  const documentType = String(formData.get("documentType") ?? "").trim();
  const customName = String(formData.get("fileName") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecciona un archivo." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "El archivo supera el tamaño máximo (25 MB)." };
  }
  const originalName = sanitizeFileName(file.name);
  if (!isAllowedExtension(originalName)) {
    return {
      ok: false,
      error: `Formato no permitido. Aceptados: ${ALLOWED_DOC_EXTENSIONS.join(", ")}`,
    };
  }

  const { ctx, db } = await requireOrgDb();
  const bytes = Buffer.from(await file.arrayBuffer());
  const { storageKey } = await saveUploadedFile(
    ctx.organizationId,
    originalName,
    bytes,
  );

  const displayName = customName || originalName;
  const document = await db.document.create({
    data: {
      organizationId: ctx.organizationId,
      entityType,
      entityId,
      fileName: displayName,
      fileUrl: "", // se sirve por route handler; sin enlace externo
      storageKey,
      documentType: documentType || null,
      mimeType: file.type || null,
      sizeBytes: bytes.length,
      uploadedById: ctx.userId,
    },
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType,
    entityId,
    action: "document_added",
    summary: `Documento subido: ${displayName}`,
    userId: ctx.userId,
  });

  revalidatePath(entityPath(entityType, entityId));
  return { ok: true, id: document.id };
}

export async function deleteDocumentAction(
  id: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();

  const document = await db.document.findFirst({
    where: { id },
    select: {
      id: true,
      fileName: true,
      entityType: true,
      entityId: true,
      storageKey: true,
    },
  });
  if (!document) {
    return { ok: false, error: "El documento no existe o no tienes acceso." };
  }

  await db.document.delete({ where: { id } });
  if (document.storageKey) {
    await deleteStoredFile(document.storageKey);
  }

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: document.entityType,
    entityId: document.entityId,
    action: "document_removed",
    summary: `Documento eliminado: ${document.fileName}`,
    userId: ctx.userId,
  });

  revalidatePath(
    entityPath(document.entityType as DocumentEntity, document.entityId),
  );
  return { ok: true, id };
}
