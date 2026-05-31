import { NextResponse } from "next/server";
import { requireOrgDb } from "@/server/context";

/**
 * Devuelve el status (PROSPECTO/ACTIVO/INACTIVO) de un cliente del tenant y
 * sus datos de contacto, para precargar el contacto del contratante en la
 * propuesta (obs 4).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { db } = await requireOrgDb();
  const client = await db.client.findFirst({
    where: { id },
    select: { status: true, email: true, phone: true, celular: true },
  });
  if (!client) {
    return NextResponse.json({ status: null }, { status: 404 });
  }
  return NextResponse.json({
    status: client.status,
    email: client.email,
    phone: client.phone,
    celular: client.celular,
  });
}
