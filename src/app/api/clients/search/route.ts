import { NextResponse } from "next/server";
import { requireOrgDb } from "@/server/context";
import { searchClients } from "@/features/clients/queries";

export async function GET(req: Request) {
  const { ctx, db } = await requireOrgDb();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? "20") || 20,
    50,
  );
  const rows = await searchClients(ctx, db, q, limit);
  return NextResponse.json({ items: rows });
}
