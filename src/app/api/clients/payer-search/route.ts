import { NextResponse } from "next/server";
import { requireOrgDb } from "@/server/context";
import { findClientForPayer } from "@/features/clients/queries";

/** Busca un cliente por RUT/nombre para autocompletar datos del pagador. */
export async function GET(req: Request) {
  const { ctx, db } = await requireOrgDb();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const match = await findClientForPayer(ctx, db, q);
  return NextResponse.json({ items: match ? [match] : [] });
}
