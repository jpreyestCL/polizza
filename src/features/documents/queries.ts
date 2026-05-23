import "server-only";
import type { Db } from "@/server/db";
import type { DocumentEntity } from "./schemas";

export type DocumentItem = {
  id: string;
  fileName: string;
  fileUrl: string;
  documentType: string | null;
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
      documentType: true,
      createdAt: true,
    },
  });
}
