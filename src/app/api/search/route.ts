import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { canSeeAllClients } from "@/lib/roles";
import { cleanRut } from "@/lib/rut";

/** Búsqueda global. MVP: clientes por nombre, RUT o correo. */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const { ctx, db } = await requireOrgDb();

  const where: Prisma.ClientWhereInput = {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { legalName: { contains: query, mode: "insensitive" } },
      { rut: { contains: cleanRut(query) } },
      { email: { contains: query, mode: "insensitive" } },
    ],
  };
  if (!canSeeAllClients(ctx.role)) {
    where.assignedUserId = ctx.userId;
  }

  const results = await db.client.findMany({
    where,
    take: 8,
    orderBy: { name: "asc" },
    select: { id: true, name: true, rut: true, type: true },
  });

  return NextResponse.json({ results });
}
