import { NextResponse } from "next/server";
import { basePrisma } from "@/server/db";
import { requireOrgDb } from "@/server/context";

export async function GET(req: Request) {
  // Solo para usuarios autenticados con organización.
  await requireOrgDb();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? "30") || 30,
    100,
  );
  const rows = await basePrisma.commune.findMany({
    where: {
      isActive: true,
      ...(q
        ? { name: { contains: q, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, code: true, name: true, city: true, region: true },
  });
  return NextResponse.json({ items: rows });
}
