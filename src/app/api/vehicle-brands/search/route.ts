import { NextResponse } from "next/server";
import { basePrisma } from "@/server/db";
import { requireOrgDb } from "@/server/context";

export async function GET(req: Request) {
  await requireOrgDb();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? "30") || 30,
    100,
  );
  const rows = await basePrisma.vehicleBrand.findMany({
    where: {
      active: true,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, name: true },
  });
  return NextResponse.json({ items: rows });
}
