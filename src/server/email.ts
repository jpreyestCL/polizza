import "server-only";

export type EmailAttachment = {
  filename: string;
  /** Contenido binario o texto del adjunto. */
  content: Buffer | string;
  contentType?: string;
};

type SendEmailInput = {
  to: string;
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
};

/**
 * Envío de email con transporte conectable.
 * - EMAIL_TRANSPORT="resend": usa la API de Resend.
 * - cualquier otro valor (por defecto "console"): loguea el contenido. Útil en
 *   desarrollo — el enlace de invitación o recuperación aparece en la consola.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const transport = process.env.EMAIL_TRANSPORT ?? "console";

  if (transport === "resend" && process.env.RESEND_API_KEY) {
    const attachments = input.attachments?.map((a) => ({
      filename: a.filename,
      content:
        typeof a.content === "string"
          ? Buffer.from(a.content, "utf-8").toString("base64")
          : a.content.toString("base64"),
      content_type: a.contentType,
    }));
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Polizza <no-reply@polizza.cl>",
        to: input.to,
        cc: input.cc,
        subject: input.subject,
        text: input.text,
        html: input.html ?? `<p>${input.text}</p>`,
        attachments,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend respondió ${res.status}: ${await res.text()}`);
    }
    return;
  }

  const attachInfo = input.attachments?.length
    ? `\n  Adjuntos: ${input.attachments.map((a) => a.filename).join(", ")}`
    : "";
  console.info(
    `\n[email:console] → ${input.to}\n  Asunto: ${input.subject}\n  ${input.text}${attachInfo}\n`,
  );
}

/** Plantilla HTML mínima y sobria para correos transaccionales. */
export function emailLayout(title: string, body: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<a href="${cta.url}" style="display:inline-block;background:#1f6f78;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;margin-top:16px">${cta.label}</a>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#27313a">
    <h2 style="font-size:18px">${title}</h2>
    <p style="font-size:14px;line-height:1.5">${body}</p>
    ${button}
    <p style="font-size:12px;color:#8a949c;margin-top:24px">Polizza — gestión para corredoras de seguros</p>
  </div>`;
}
