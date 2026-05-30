import { NextResponse } from "next/server";
import { requireOrgDb } from "@/server/context";

/** Devuelve el status (PROSPECTO/ACTIVO/INACTIVO) de un cliente del tenant. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { db } = await requireOrgDb();
  const client = await db.client.findFirst({
    where: { id },
    select: { status: true },
  });
  if (!client) {
    return NextResponse.json({ status: null }, { status: 404 });
  }
  return NextResponse.json({ status: client.status });
}
