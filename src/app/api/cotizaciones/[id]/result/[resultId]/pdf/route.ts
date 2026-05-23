import { NextResponse } from "next/server";
import { requireOrgDb } from "@/server/context";
import { getResultPdf } from "@/features/car-quotes/queries";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; resultId: string }> },
) {
  const { resultId } = await context.params;
  const { db } = await requireOrgDb();
  const pdf = await getResultPdf(db, resultId);
  if (!pdf) {
    return NextResponse.json({ error: "PDF no disponible" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(pdf.pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cotizacion-${pdf.insurerName.toLowerCase().replace(/\s+/g, "-")}-${pdf.quotationNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
