import { NextResponse } from "next/server";
import { requireOrgDb } from "@/server/context";
import { readStoredFile } from "@/server/storage";

/**
 * Entrega un documento subido al servidor. `requireOrgDb` valida sesión y el
 * acceso al Document queda acotado al tenant por el extends de Prisma.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { db } = await requireOrgDb();

  const document = await db.document.findFirst({
    where: { id },
    select: { fileName: true, storageKey: true, mimeType: true, fileUrl: true },
  });
  if (!document) {
    return new NextResponse("Documento no existe", { status: 404 });
  }

  // Si es un enlace externo (sin storageKey) redirigimos al enlace.
  if (!document.storageKey) {
    if (document.fileUrl) {
      return NextResponse.redirect(document.fileUrl);
    }
    return new NextResponse("Documento sin archivo", { status: 404 });
  }

  const bytes = await readStoredFile(document.storageKey);
  if (!bytes) {
    return new NextResponse("Archivo no encontrado en el servidor", {
      status: 404,
    });
  }

  const safeName = document.fileName.replace(/["\r\n]/g, "");
  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": document.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${safeName}"`,
    },
  });
}
