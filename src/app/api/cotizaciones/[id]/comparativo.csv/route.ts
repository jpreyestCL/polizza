import { NextResponse } from "next/server";
import { requireOrgDb } from "@/server/context";
import { getCarQuotationDetail } from "@/features/car-quotes/queries";
import { buildComparativeCsv } from "@/features/car-quotes/pdf";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { db } = await requireOrgDb();
  const quotation = await getCarQuotationDetail(db, id);
  if (!quotation) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  }
  const csv = buildComparativeCsv(quotation);
  // BOM para que Excel detecte UTF-8.
  return new NextResponse("﻿" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="comparativo-${quotation.quotationNumber}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
