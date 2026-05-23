import { NextResponse } from "next/server";
import { basePrisma } from "@/server/db";
import { requireOrgDb } from "@/server/context";

export async function GET(req: Request) {
  await requireOrgDb();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  // El cliente puede pasar el NOMBRE de la marca (no el id) porque la ficha
  // tiene solo el texto. Si llega, filtramos por marca; si no, buscamos en
  // todos los modelos.
  const brand = (url.searchParams.get("brand") ?? "").trim();
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? "30") || 30,
    100,
  );
  const rows = await basePrisma.vehicleModel.findMany({
    where: {
      active: true,
      ...(brand
        ? { brand: { name: { equals: brand, mode: "insensitive" as const } } }
        : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" },
    take: limit,
    select: {
      id: true,
      name: true,
      brand: { select: { name: true } },
    },
  });
  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      brandName: r.brand.name,
    })),
  });
}
