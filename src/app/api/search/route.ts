import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { canSeeAllClients } from "@/lib/roles";
import { cleanRut } from "@/lib/rut";

/** Búsqueda global: clientes por nombre/RUT/correo y pólizas por número. */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const { ctx, db } = await requireOrgDb();
  const seeAll = canSeeAllClients(ctx.role);

  const clientWhere: Prisma.ClientWhereInput = {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { legalName: { contains: query, mode: "insensitive" } },
      { rut: { contains: cleanRut(query) } },
      { email: { contains: query, mode: "insensitive" } },
    ],
  };
  if (!seeAll) clientWhere.assignedUserId = ctx.userId;

  // El ejecutivo solo ve pólizas de su propia cartera, igual que los clientes.
  const policyWhere: Prisma.PolicyWhereInput = {
    policyNumber: { contains: query, mode: "insensitive" },
  };
  if (!seeAll) policyWhere.client = { assignedUserId: ctx.userId };

  const [clients, policies] = await Promise.all([
    db.client.findMany({
      where: clientWhere,
      take: 6,
      orderBy: { name: "asc" },
      select: { id: true, name: true, rut: true, type: true },
    }),
    db.policy.findMany({
      where: policyWhere,
      take: 6,
      orderBy: { policyNumber: "asc" },
      select: {
        id: true,
        policyNumber: true,
        status: true,
        client: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    results: [
      ...policies.map((p) => ({
        kind: "policy" as const,
        id: p.id,
        policyNumber: p.policyNumber,
        clientName: p.client?.name ?? "",
        status: p.status,
      })),
      ...clients.map((c) => ({
        kind: "client" as const,
        id: c.id,
        name: c.name,
        rut: c.rut,
        type: c.type,
      })),
    ],
  });
}
