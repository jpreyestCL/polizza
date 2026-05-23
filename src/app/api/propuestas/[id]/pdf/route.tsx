import { NextResponse } from "next/server";
import { requireOrgDb } from "@/server/context";
import { buildProposalPdfData } from "@/features/proposal-pdf/build-pdf-data";
import { renderProposalPdf } from "@/features/proposal-pdf/render";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { db } = await requireOrgDb();

  const stored = await db.proposal.findFirst({
    where: { id },
    select: { proposalNumber: true, pdfBytes: true },
  });
  if (!stored) {
    return new NextResponse("Propuesta no existe", { status: 404 });
  }

  if (stored.pdfBytes) {
    return new NextResponse(stored.pdfBytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="propuesta-${stored.proposalNumber}.pdf"`,
      },
    });
  }

  const data = await buildProposalPdfData(db, id);
  if (!data) {
    return new NextResponse("Propuesta no existe", { status: 404 });
  }
  const buffer = await renderProposalPdf(data);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="propuesta-${data.proposalNumber}.pdf"`,
    },
  });
}
