import { NextResponse } from "next/server";
import { requireOrgDb } from "@/server/context";
import { getCarQuotationDetail } from "@/features/car-quotes/queries";
import { buildComparativePdf } from "@/features/car-quotes/pdf";

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
  const pdf = await buildComparativePdf(quotation);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="comparativo-${quotation.quotationNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
