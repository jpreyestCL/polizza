import "server-only";
import type { Db } from "@/server/db";
import type { DocumentEntity } from "./schemas";

export type DocumentItem = {
  id: string;
  fileName: string;
  fileUrl: string;
  storageKey: string | null;
  documentType: string | null;
  sizeBytes: number | null;
  createdAt: Date;
};

/** Documentos adjuntos a una entidad, del más reciente al más antiguo. */
export async function listDocuments(
  db: Db,
  entityType: DocumentEntity,
  entityId: string,
): Promise<DocumentItem[]> {
  return db.document.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      storageKey: true,
      documentType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });
}
