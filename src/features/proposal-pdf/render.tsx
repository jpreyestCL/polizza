import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { ProposalPdfTemplate } from "./pdf-template";
import { EndorsementPdfTemplate } from "./endorsement-pdf-template";
import type { PdfDocumentData } from "./build-pdf-data";

export async function renderProposalPdf(data: PdfDocumentData): Promise<Buffer> {
  const buffer = await renderToBuffer(
    data.kind === "ENDOSO" ? (
      <EndorsementPdfTemplate data={data} />
    ) : (
      <ProposalPdfTemplate data={data} />
    ),
  );
  return buffer as Buffer;
}
