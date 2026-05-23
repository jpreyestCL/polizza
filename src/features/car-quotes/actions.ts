"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
/* Prisma se usa para detectar P2002. */
import { logActivity } from "@/server/activity";
import { canDeleteProposal } from "@/lib/roles";
import { sendEmail } from "@/server/email";
import { getInsurerAdapter } from "./insurers";
import { runQuotationQueue, reprocessResult } from "./worker";
import { buildComparativePdf, buildComparativeCsv } from "./pdf";
import {
  carQuotationFormSchema,
  sendQuotationEmailSchema,
  type CarQuotationFormValues,
  type SendQuotationEmailValues,
} from "./schemas";
import { lookupVehicle } from "./vehicle-lookup";

export type ActionResult<T = { id: string }> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseAnio(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

// El numerador se calcula inline dentro de la transacción para evitar
// problemas de tipado con el cliente Prisma extendido.

export async function createCarQuotationAction(
  values: CarQuotationFormValues,
): Promise<ActionResult> {
  const parsed = carQuotationFormSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string") fieldErrors[path] = issue.message;
    }
    return {
      ok: false,
      error: "Revisa los datos del formulario.",
      fieldErrors,
    };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const client = await db.client.findFirst({
    where: { id: data.clientId },
    select: { id: true, name: true },
  });
  if (!client) {
    return {
      ok: false,
      error: "El cliente seleccionado no existe.",
      fieldErrors: { clientId: "Cliente inválido" },
    };
  }

  // Validar que las aseguradoras estén soportadas.
  for (const key of data.insurerKeys) {
    if (!getInsurerAdapter(key)) {
      return {
        ok: false,
        error: `Aseguradora '${key}' no soportada.`,
      };
    }
  }

  let createdId: string;
  try {
    const created = await db.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const prefix = `COT-AUTO-${year}-`;
      const count = await tx.carQuotation.count({
        where: { quotationNumber: { startsWith: prefix } },
      });
      const quotationNumber = `${prefix}${String(count + 1).padStart(4, "0")}`;
      const quotation = await tx.carQuotation.create({
        data: {
          organizationId: ctx.organizationId,
          clientId: data.clientId,
          quotationNumber,
          status: "EN_PROCESO",
          patente: data.patente,
          marca: emptyToNull(data.marca),
          modelo: emptyToNull(data.modelo),
          anio: parseAnio(data.anio),
          tipoVehiculo: emptyToNull(data.tipoVehiculo),
          motorizacion: emptyToNull(data.motorizacion),
          vehicleCondition: data.vehicleCondition,
          vehicleUse: data.vehicleUse,
          civilLiability: data.civilLiability,
          workshopType: data.workshopType,
          deductibles: data.deductibles,
          assignedUserId: emptyToNull(data.assignedUserId) ?? ctx.userId,
          createdById: ctx.userId,
          notes: emptyToNull(data.notes),
        },
      });
      for (const key of data.insurerKeys) {
        const adapter = getInsurerAdapter(key)!;
        await tx.carQuotationResult.create({
          data: {
            organizationId: ctx.organizationId,
            quotationId: quotation.id,
            insurerKey: adapter.key,
            insurerName: adapter.name,
            status: "PENDIENTE",
          },
        });
      }
      return quotation;
    });
    createdId = created.id;

    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "CAR_QUOTATION",
      entityId: created.id,
      action: "created",
      summary: `Cotización ${created.quotationNumber} creada para ${client.name} (${data.patente})`,
      userId: ctx.userId,
    });
    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "CLIENT",
      entityId: data.clientId,
      action: "car_quotation_created",
      summary: `Nueva cotización de auto: ${created.quotationNumber}`,
      userId: ctx.userId,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Conflicto al numerar la cotización. Intenta nuevamente.",
      };
    }
    throw error;
  }

  // Dispara el procesamiento en background. No esperar.
  void runQuotationQueue(createdId);

  revalidatePath("/cotizaciones");
  revalidatePath(`/clientes/${data.clientId}`);
  return { ok: true, id: createdId };
}

export async function lookupVehicleAction(
  patente: string,
): Promise<
  | { ok: true; data: { marca: string | null; modelo: string | null; anio: number | null; tipoVehiculo: string | null; motorizacion: string | null }; source: string }
  | { ok: false; error: string }
> {
  await requireOrgDb();
  const result = await lookupVehicle(patente);
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    source: result.source,
    data: {
      marca: result.data.marca,
      modelo: result.data.modelo,
      anio: result.data.anio,
      tipoVehiculo: result.data.tipoVehiculo,
      motorizacion: result.data.motorizacion,
    },
  };
}

export async function reprocessResultAction(
  resultId: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  const result = await db.carQuotationResult.findFirst({
    where: { id: resultId },
    select: { id: true, quotationId: true, insurerName: true },
  });
  if (!result) {
    return { ok: false, error: "Resultado no encontrado." };
  }
  await reprocessResult(ctx.organizationId, resultId);
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CAR_QUOTATION",
    entityId: result.quotationId,
    action: "result_reprocessed",
    summary: `Reintentando cotización en ${result.insurerName}`,
    userId: ctx.userId,
  });
  revalidatePath(`/cotizaciones/${result.quotationId}`);
  return { ok: true, id: resultId };
}

export async function sendQuotationEmailAction(
  quotationId: string,
  values: SendQuotationEmailValues,
): Promise<ActionResult> {
  const parsed = sendQuotationEmailSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string") fieldErrors[path] = issue.message;
    }
    return {
      ok: false,
      error: "Revisa los datos del formulario.",
      fieldErrors,
    };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const quotation = await db.carQuotation.findFirst({
    where: { id: quotationId },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          rut: true,
          email: true,
          contacts: {
            select: { id: true, name: true, email: true, isPrimary: true },
            where: { email: { not: null } },
            orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
          },
        },
      },
      results: true,
    },
  });
  if (!quotation) {
    return { ok: false, error: "La cotización no existe." };
  }

  const attachments: {
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }[] = [];

  // PDF comparativo + CSV
  if (data.attachComparativePdf || data.attachComparativeCsv) {
    const detail = {
      ...quotation,
      results: quotation.results.map((r) => ({
        ...r,
        premiumUf: r.premiumUf ? Number(r.premiumUf) : null,
        deductibleUf: r.deductibleUf ? Number(r.deductibleUf) : null,
      })),
    } as unknown as Parameters<typeof buildComparativePdf>[0];
    if (data.attachComparativePdf) {
      const pdf = await buildComparativePdf(detail);
      attachments.push({
        filename: `comparativo-${quotation.quotationNumber}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      });
    }
    if (data.attachComparativeCsv) {
      const csv = buildComparativeCsv(detail);
      attachments.push({
        filename: `comparativo-${quotation.quotationNumber}.csv`,
        content: "﻿" + csv,
        contentType: "text/csv",
      });
    }
  }

  // PDFs individuales de aseguradoras
  if (data.attachResultIds.length > 0) {
    for (const resultId of data.attachResultIds) {
      const result = await db.carQuotationResult.findFirst({
        where: { id: resultId, quotationId },
        select: { insurerName: true, insurerKey: true, pdfBytes: true },
      });
      if (result?.pdfBytes) {
        attachments.push({
          filename: `cotizacion-${result.insurerKey}-${quotation.quotationNumber}.pdf`,
          content: Buffer.from(result.pdfBytes),
          contentType: "application/pdf",
        });
      }
    }
  }

  const ccList = data.cc
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s && s.includes("@"));

  try {
    await sendEmail({
      to: data.to,
      cc: ccList.length > 0 ? ccList : undefined,
      subject: data.subject,
      text: data.body,
      html: `<div style="font-family:Arial,sans-serif;max-width:540px;color:#27313a;font-size:14px;line-height:1.55;white-space:pre-wrap">${escapeHtml(data.body)}</div>`,
      attachments,
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `No se pudo enviar: ${error.message}`
          : "No se pudo enviar el correo.",
    };
  }

  const summary = `Cotización enviada por correo a ${data.to}${
    ccList.length > 0 ? ` (cc ${ccList.join(", ")})` : ""
  } — ${attachments.length} adjunto(s)`;
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CAR_QUOTATION",
    entityId: quotationId,
    action: "email_sent",
    summary,
    userId: ctx.userId,
    metadata: {
      to: data.to,
      cc: ccList,
      subject: data.subject,
      attachments: attachments.map((a) => a.filename),
      template: data.template,
    },
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLIENT",
    entityId: quotation.client.id,
    action: "car_quotation_emailed",
    summary: `Cotización ${quotation.quotationNumber} enviada a ${data.to}`,
    userId: ctx.userId,
  });

  revalidatePath(`/cotizaciones/${quotationId}`);
  revalidatePath(`/clientes/${quotation.client.id}`);
  return { ok: true, id: quotationId };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function contractResultAction(
  resultId: string,
): Promise<ActionResult<{ proposalId: string }>> {
  const { ctx, db } = await requireOrgDb();
  const result = await db.carQuotationResult.findFirst({
    where: { id: resultId },
    include: {
      quotation: {
        include: { client: { select: { id: true, name: true } } },
      },
    },
  });
  if (!result) {
    return { ok: false, error: "Resultado no encontrado." };
  }
  if (result.status !== "OBTENIDA") {
    return {
      ok: false,
      error: "Solo puedes contratar resultados con cotización obtenida.",
    };
  }

  // Resolver / crear aseguradora en el catálogo
  let company = await db.insuranceCompany.findFirst({
    where: { name: result.insurerName },
    select: { id: true },
  });
  if (!company) {
    company = await db.insuranceCompany.create({
      data: {
        organizationId: ctx.organizationId,
        name: result.insurerName,
        status: "ACTIVA",
      },
      select: { id: true },
    });
  }
  let line = await db.insuranceLine.findFirst({
    where: { name: "Automóvil" },
    select: { id: true },
  });
  if (!line) {
    line = await db.insuranceLine.create({
      data: {
        organizationId: ctx.organizationId,
        name: "Automóvil",
        code: "AUTO",
        category: "GENERALES",
      },
      select: { id: true },
    });
  }

  const proposal = await db.$transaction(async (tx) => {
    const year = new Date().getFullYear();
    const count = await tx.proposal.count({
      where: { organizationId: ctx.organizationId },
    });
    const proposalNumber = `P-${year}-${String(count + 1).padStart(4, "0")}`;
    const created = await tx.proposal.create({
      data: {
        organizationId: ctx.organizationId,
        clientId: result.quotation.clientId,
        proposalNumber,
        companyId: company!.id,
        lineId: line!.id,
        status: "ELABORACION",
        premiumNet: result.premiumUf ?? undefined,
        currency: "UF",
        assignedUserId: result.quotation.assignedUserId ?? ctx.userId,
        currentStateStartedAt: new Date(),
        createdById: ctx.userId,
      },
    });
    await tx.proposalStatusHistory.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId: created.id,
        status: "ELABORACION",
        note: `Origen: cotización ${result.quotation.quotationNumber} (${result.insurerName})`,
        changedById: ctx.userId,
      },
    });
    return created;
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CAR_QUOTATION",
    entityId: result.quotationId,
    action: "result_contracted",
    summary: `Contratada propuesta ${proposal.proposalNumber} con ${result.insurerName}`,
    userId: ctx.userId,
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "PROPOSAL",
    entityId: proposal.id,
    action: "created_from_quotation",
    summary: `Propuesta creada desde cotización ${result.quotation.quotationNumber}`,
    userId: ctx.userId,
    metadata: { quotationId: result.quotationId, resultId },
  });

  revalidatePath(`/cotizaciones/${result.quotationId}`);
  revalidatePath("/propuestas");
  return { ok: true, proposalId: proposal.id };
}

export async function deleteCarQuotationAction(
  id: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!canDeleteProposal(ctx.role)) {
    return { ok: false, error: "No tienes permiso para eliminar cotizaciones." };
  }
  const existing = await db.carQuotation.findFirst({
    where: { id },
    select: { id: true, quotationNumber: true, clientId: true },
  });
  if (!existing) {
    return { ok: false, error: "La cotización no existe o no tienes acceso." };
  }
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CAR_QUOTATION",
    entityId: id,
    action: "deleted",
    summary: `Cotización ${existing.quotationNumber} eliminada`,
    userId: ctx.userId,
  });
  await db.carQuotation.delete({ where: { id } });
  revalidatePath("/cotizaciones");
  revalidatePath(`/clientes/${existing.clientId}`);
  return { ok: true, id };
}

/** Devuelve los valores por defecto del form para recotizar (basados en otra cotización). */
export async function getRequoteDefaults(
  previousId: string,
): Promise<CarQuotationFormValues | null> {
  const { db } = await requireOrgDb();
  const prev = await db.carQuotation.findFirst({
    where: { id: previousId },
    include: { results: { select: { insurerKey: true } } },
  });
  if (!prev) return null;
  const deductibles = Array.isArray(prev.deductibles)
    ? (prev.deductibles as unknown[])
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n))
    : [];
  return {
    clientId: prev.clientId,
    patente: prev.patente,
    marca: prev.marca ?? "",
    modelo: prev.modelo ?? "",
    anio: prev.anio ? String(prev.anio) : "",
    tipoVehiculo: prev.tipoVehiculo ?? "",
    motorizacion: prev.motorizacion ?? "",
    vehicleCondition: prev.vehicleCondition,
    vehicleUse: prev.vehicleUse,
    civilLiability: prev.civilLiability,
    workshopType: prev.workshopType,
    deductibles,
    insurerKeys: prev.results.map((r) => r.insurerKey),
    assignedUserId: prev.assignedUserId ?? "",
    notes: prev.notes ?? "",
  };
}
