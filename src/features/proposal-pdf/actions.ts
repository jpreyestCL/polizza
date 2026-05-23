"use server";

import { revalidatePath } from "next/cache";
import { renderProposalPdf } from "./render";
import { requireOrgDb } from "@/server/context";
import { sendEmail, emailLayout } from "@/server/email";
import { buildProposalPdfData } from "./build-pdf-data";

type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/**
 * Genera el PDF y lo persiste en la propuesta. Cambia estado a POR_ENVIAR
 * y bloquea edición posterior hasta que se reabra la propuesta.
 */
export async function generateAndStoreProposalPdfAction(
  proposalId: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  const proposal = await db.proposal.findFirst({
    where: { id: proposalId },
    select: { id: true, status: true, proposalNumber: true },
  });
  if (!proposal) return { ok: false, error: "Propuesta no existe." };
  if (proposal.status !== "ELABORACION" && proposal.status !== "DEVUELTA") {
    return {
      ok: false,
      error: "Solo se puede generar el PDF desde Elaboración o Devuelta.",
    };
  }

  const data = await buildProposalPdfData(db, proposalId);
  if (!data) return { ok: false, error: "No se pudo cargar la propuesta." };
  const pdfBuffer = await renderProposalPdf(data);

  await db.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposalId },
      data: {
        status: "POR_ENVIAR",
        currentStateStartedAt: new Date(),
        pdfBytes: Buffer.from(pdfBuffer),
        pdfGeneratedAt: new Date(),
      },
    });
    await tx.proposalStatusHistory.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId,
        status: "POR_ENVIAR",
        note: "PDF generado y propuesta lista para enviar",
        changedById: ctx.userId,
      },
    });
    await tx.proposalLog.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId,
        action: "PDF_GENERATED",
        summary: "PDF de la propuesta generado",
        userId: ctx.userId,
      },
    });
  });

  revalidatePath(`/propuestas/${proposalId}`);
  return { ok: true, message: "PDF generado. Propuesta lista para enviar." };
}

/**
 * Reabre una propuesta: borra el PDF guardado y vuelve a ELABORACION
 * para permitir edición.
 */
export async function reopenProposalAction(
  proposalId: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  const proposal = await db.proposal.findFirst({
    where: { id: proposalId },
    select: { id: true, status: true },
  });
  if (!proposal) return { ok: false, error: "Propuesta no existe." };
  if (proposal.status !== "POR_ENVIAR") {
    return {
      ok: false,
      error: "Solo se pueden reabrir propuestas en estado Por enviar.",
    };
  }

  await db.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposalId },
      data: {
        status: "ELABORACION",
        currentStateStartedAt: new Date(),
        pdfBytes: null,
        pdfGeneratedAt: null,
      },
    });
    await tx.proposalStatusHistory.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId,
        status: "ELABORACION",
        note: "Propuesta reabierta para edición (PDF eliminado)",
        changedById: ctx.userId,
      },
    });
    await tx.proposalLog.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId,
        action: "PDF_REOPENED",
        summary: "Propuesta reabierta — PDF eliminado",
        userId: ctx.userId,
      },
    });
  });

  revalidatePath(`/propuestas/${proposalId}`);
  return { ok: true, message: "Propuesta reabierta para edición." };
}

export async function sendProposalByEmailAction(
  proposalId: string,
  options: {
    toEmail?: string;
    cc?: string[];
    bcc?: string[];
    subject?: string;
    body?: string;
    documentIds?: string[]; // documentos de la propuesta a incluir como links
    markOnly?: boolean;
  } = {},
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  const proposal = await db.proposal.findFirst({
    where: { id: proposalId },
    include: {
      client: { select: { name: true } },
    },
  });
  if (!proposal) return { ok: false, error: "Propuesta no existe." };

  // Datos de la organización (nombre corredora)
  const org = await basePrismaForOrg(ctx.organizationId);

  const recipient =
    options.toEmail?.trim() || proposal.recipientEmail?.trim() || null;

  if (options.markOnly || !recipient) {
    await db.proposal.update({
      where: { id: proposalId },
      data: { sentAt: new Date(), status: "ENVIADA_COMPANIA" },
    });
    await db.proposalStatusHistory.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId,
        status: "ENVIADA_COMPANIA",
        note: options.markOnly
          ? "Marcada como enviada (sin envío real)"
          : "Marcada como enviada (sin destinatario)",
        changedById: ctx.userId,
      },
    });
    await db.proposalLog.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId,
        action: "EMAIL_MARKED",
        summary: "Marcada como enviada a la compañía",
        userId: ctx.userId,
      },
    });
    revalidatePath(`/propuestas/${proposalId}`);
    return { ok: true, message: "Marcada como enviada" };
  }

  // Reusar PDF persistido si existe, evita re-renderizar.
  const stored = await db.proposal.findFirst({
    where: { id: proposalId },
    select: { pdfBytes: true },
  });
  let pdfBuffer: Buffer | Uint8Array;
  if (stored?.pdfBytes) {
    pdfBuffer = Buffer.from(stored.pdfBytes);
  } else {
    const data = await buildProposalPdfData(db, proposalId);
    if (!data) return { ok: false, error: "No se pudo cargar la propuesta." };
    pdfBuffer = await renderProposalPdf(data);
  }

  // Documentos seleccionados → links en el cuerpo del email
  let docs: { fileName: string; fileUrl: string }[] = [];
  if (options.documentIds && options.documentIds.length > 0) {
    docs = await db.document.findMany({
      where: {
        id: { in: options.documentIds },
        entityType: "PROPOSAL",
        entityId: proposalId,
      },
      select: { fileName: true, fileUrl: true },
    });
  }

  const ccList = (options.cc ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const bccList = (options.bcc ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const subject =
    options.subject?.trim() ||
    `Propuesta de Seguro N° ${proposal.proposalNumber} de ${org?.name ?? "Polizza"} - ${proposal.client.name}`;
  const note = options.body?.trim();

  const docsHtml =
    docs.length > 0
      ? `<p style="font-size:13px;margin-top:12px"><b>Documentos adjuntos por enlace:</b></p><ul style="font-size:13px">${docs
          .map(
            (d) =>
              `<li><a href="${d.fileUrl}" target="_blank">${d.fileName}</a></li>`,
          )
          .join("")}</ul>`
      : "";

  const body =
    note ||
    `Estimados,\n\nFavor asignar folio/ciclo para la emisión de la propuesta N° ${proposal.proposalNumber} para nuestro cliente ${proposal.client.name}. La propuesta se adjunta en PDF.\n\nFavor acusar recibo de la recepción de este correo.\n\nLes saluda atentamente,\n${org?.name ?? "Polizza"}`;
  const html = emailLayout(
    subject,
    body
      .split("\n")
      .map((l) => `<div>${escapeHtml(l) || "&nbsp;"}</div>`)
      .join("") + docsHtml,
  );

  try {
    await sendEmail({
      to: recipient,
      cc: ccList.length > 0 ? ccList : undefined,
      subject,
      text:
        body +
        (docs.length > 0
          ? "\n\nDocumentos adjuntos por enlace:\n" +
            docs.map((d) => `- ${d.fileName}: ${d.fileUrl}`).join("\n")
          : ""),
      html,
      attachments: [
        {
          filename: `propuesta-${proposal.proposalNumber}.pdf`,
          content: Buffer.from(pdfBuffer),
          contentType: "application/pdf",
        },
      ],
    });
  } catch (e) {
    console.error("Email send error", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error al enviar email.",
    };
  }

  await db.proposal.update({
    where: { id: proposalId },
    data: { sentAt: new Date(), status: "ENVIADA_COMPANIA" },
  });
  await db.proposalStatusHistory.create({
    data: {
      organizationId: ctx.organizationId,
      proposalId,
      status: "ENVIADA_COMPANIA",
      note: `Enviada a ${recipient}${ccList.length > 0 ? ` (CC: ${ccList.join(", ")})` : ""}`,
      changedById: ctx.userId,
    },
  });
  await db.proposalLog.create({
    data: {
      organizationId: ctx.organizationId,
      proposalId,
      action: "EMAIL_SENT",
      summary:
        `Email enviado a ${recipient}` +
        (ccList.length > 0 ? ` (CC: ${ccList.join(", ")})` : "") +
        (docs.length > 0 ? ` con ${docs.length} documento(s)` : ""),
      userId: ctx.userId,
    },
  });
  revalidatePath(`/propuestas/${proposalId}`);
  return { ok: true, message: `Email enviado a ${recipient}` };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function basePrismaForOrg(organizationId: string) {
  const { basePrisma } = await import("@/server/db");
  return basePrisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
}
