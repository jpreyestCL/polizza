import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { ProposalPdfTemplate, type PdfProposal } from "./pdf-template";

export async function renderProposalPdf(data: PdfProposal): Promise<Buffer> {
  const buffer = await renderToBuffer(<ProposalPdfTemplate data={data} />);
  return buffer as Buffer;
}
