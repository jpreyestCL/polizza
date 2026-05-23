"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { basePrisma } from "@/server/db";
import { logActivity } from "@/server/activity";
import { canDeleteProposal } from "@/lib/roles";
import { sanitizeRichText } from "@/lib/sanitize";
import { sendEmail } from "@/server/email";
import { formatDate } from "@/lib/utils";
import {
  cartaReservaHtml,
  cartaReservaSubject,
  cartaReservaText,
} from "./emails/carta-reserva";
import { generateProposalNumber } from "./number-generator";
import {
  proposalFormSchema,
  proposalDraftSchema,
  statusChangeSchema,
  STATUS_LABELS,
  isProposalLocked,
  type ProposalFormValues,
  type ProposalDraftValues,
  type StatusChangeValues,
} from "./schemas";

function decimalOrNull(value: string): Prisma.Decimal | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return new Prisma.Decimal(n);
}

function jsonOrNull(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) return Prisma.JsonNull;
  // Considerar vacío si todos los campos del objeto están vacíos.
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const allEmpty = Object.values(obj).every(
      (v) => v === undefined || v === null || v === "",
    );
    if (allEmpty) return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
}

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function amount(value: string): string | null {
  return value === "" ? null : value;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function createProposalAction(
  values: ProposalFormValues,
): Promise<ActionResult> {
  const parsed = proposalFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
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

  try {
    const proposalNumber = await generateProposalNumber(
      basePrisma,
      ctx.organizationId,
    );
    const proposal = await db.$transaction(async (tx) => {
      const created = await tx.proposal.create({
        data: {
          organizationId: ctx.organizationId,
          clientId: data.clientId,
          proposalNumber,
          companyId: emptyToNull(data.insuranceCompanyId),
          lineId: emptyToNull(data.lineId),
          branchId: emptyToNull(data.branchId),
          branchTypeId: emptyToNull(data.branchTypeId),
          productId: emptyToNull(data.productId),
          insuredClientId: emptyToNull(data.insuredClientId),
          beneficiaryClientId: emptyToNull(data.beneficiaryClientId),
          status: "ELABORACION",
          premiumNet: amount(data.premiumNet),
          premiumGross: amount(data.premiumGross),
          currency: data.currency,
          startDate: parseDate(data.startDate),
          endDate: parseDate(data.endDate),
          sentAt: parseDate(data.sentAt),
          recipientEmail: emptyToNull(data.recipientEmail),
          recipientContactId: emptyToNull(data.recipientContactId),
          quotationId: emptyToNull(data.quotationId),
          quotationNumberRef: emptyToNull(data.quotationNumberRef),
          previousPolicyId: emptyToNull(data.previousPolicyId),
          coaseguro: data.coaseguro,
          coaseguroDetails: jsonOrNull(data.coaseguroDetails),
          coCorredor: data.coCorredor,
          coCorredorDetails: jsonOrNull(data.coCorredorDetails),
          reaseguro: data.reaseguro,
          reaseguroDetails: jsonOrNull(data.reaseguroDetails),
          deOtroCorredor: data.deOtroCorredor,
          garantiaSuscripcion: data.garantiaSuscripcion,
          garantiaObservations: data.garantiaObservations
            ? sanitizeRichText(data.garantiaObservations)
            : null,
          garantiaExpiry: parseDate(data.garantiaExpiry),
          garantiaCompleted: data.garantiaCompleted,
          garantiaCompletedAt: parseDate(data.garantiaCompletedAt),
          conReserva: data.conReserva,
          conClausulaInalterabilidad: data.conClausulaInalterabilidad,
          facultativo: data.facultativo,
          isRenewal: data.isRenewal,
          previousPolicyNumberText: emptyToNull(data.previousPolicyNumberText),
          commissionAffectPct: decimalOrNull(data.commissionAffectPct),
          commissionExemptPct: decimalOrNull(data.commissionExemptPct),
          observations: data.observations
            ? sanitizeRichText(data.observations)
            : null,
          assignedUserId: emptyToNull(data.assignedUserId) ?? ctx.userId,
          salespersonId: emptyToNull(data.salespersonId),
          currentStateStartedAt: new Date(),
          createdById: ctx.userId,
        },
      });
      await replaceParticipations(tx, ctx.organizationId, created.id, data);
      await tx.proposalStatusHistory.create({
        data: {
          organizationId: ctx.organizationId,
          proposalId: created.id,
          status: "ELABORACION",
          note: "Propuesta creada",
          changedById: ctx.userId,
        },
      });
      return created;
    });

    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "PROPOSAL",
      entityId: proposal.id,
      action: "created",
      summary: `Propuesta ${proposal.proposalNumber} creada para ${client.name}`,
      userId: ctx.userId,
    });

    revalidatePath("/propuestas");
    return { ok: true, id: proposal.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Conflicto al numerar la propuesta. Intenta nuevamente.",
      };
    }
    throw error;
  }
}

export async function updateProposalAction(
  id: string,
  values: ProposalFormValues,
): Promise<ActionResult> {
  const parsed = proposalFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const existing = await db.proposal.findFirst({ where: { id } });
  if (!existing) {
    return { ok: false, error: "La propuesta no existe o no tienes acceso." };
  }
  if (isProposalLocked(existing.status)) {
    return {
      ok: false,
      error:
        "La propuesta está bloqueada para edición. Reábrela para volver a Elaboración.",
    };
  }
  const reservaTurnedOn = !existing.conReserva && data.conReserva === true;
  const client = await db.client.findFirst({
    where: { id: data.clientId },
    select: { id: true },
  });
  if (!client) {
    return {
      ok: false,
      error: "El cliente seleccionado no existe.",
      fieldErrors: { clientId: "Cliente inválido" },
    };
  }

  await db.proposal.update({
    where: { id },
    data: {
      clientId: data.clientId,
      companyId: emptyToNull(data.insuranceCompanyId),
      lineId: emptyToNull(data.lineId),
      branchTypeId: emptyToNull(data.branchTypeId),
      productId: emptyToNull(data.productId),
      insuredClientId: emptyToNull(data.insuredClientId),
      beneficiaryClientId: emptyToNull(data.beneficiaryClientId),
      premiumNet: amount(data.premiumNet),
      premiumGross: amount(data.premiumGross),
      currency: data.currency,
      startDate: parseDate(data.startDate),
      endDate: parseDate(data.endDate),
      sentAt: parseDate(data.sentAt),
      recipientEmail: emptyToNull(data.recipientEmail),
      recipientContactId: emptyToNull(data.recipientContactId),
      quotationId: emptyToNull(data.quotationId),
      quotationNumberRef: emptyToNull(data.quotationNumberRef),
      previousPolicyId: emptyToNull(data.previousPolicyId),
      coaseguro: data.coaseguro,
      coaseguroDetails: jsonOrNull(data.coaseguroDetails),
      coCorredor: data.coCorredor,
      coCorredorDetails: jsonOrNull(data.coCorredorDetails),
      reaseguro: data.reaseguro,
      reaseguroDetails: jsonOrNull(data.reaseguroDetails),
      deOtroCorredor: data.deOtroCorredor,
      garantiaSuscripcion: data.garantiaSuscripcion,
      garantiaObservations: data.garantiaObservations
        ? sanitizeRichText(data.garantiaObservations)
        : null,
      garantiaExpiry: parseDate(data.garantiaExpiry),
      garantiaCompleted: data.garantiaCompleted,
      garantiaCompletedAt: parseDate(data.garantiaCompletedAt),
      conReserva: data.conReserva,
      conClausulaInalterabilidad: data.conClausulaInalterabilidad,
      facultativo: data.facultativo,
      isRenewal: data.isRenewal,
      previousPolicyNumberText: emptyToNull(data.previousPolicyNumberText),
      commissionAffectPct: decimalOrNull(data.commissionAffectPct),
      commissionExemptPct: decimalOrNull(data.commissionExemptPct),
      observations: data.observations
        ? sanitizeRichText(data.observations)
        : null,
      assignedUserId: emptyToNull(data.assignedUserId) ?? ctx.userId,
      salespersonId: emptyToNull(data.salespersonId),
    },
  });

  await db.$transaction(async (tx) => {
    await replaceParticipations(tx, ctx.organizationId, id, data);
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "PROPOSAL",
    entityId: id,
    action: "updated",
    summary: `Propuesta ${existing.proposalNumber} actualizada`,
    userId: ctx.userId,
  });

  if (reservaTurnedOn) {
    await maybeSendReservationLetter(id);
  }

  revalidatePath("/propuestas");
  revalidatePath(`/propuestas/${id}`);
  return { ok: true, id };
}

export async function changeProposalStatusAction(
  id: string,
  values: StatusChangeValues,
): Promise<ActionResult> {
  const parsed = statusChangeSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Datos de cambio de estado inválidos." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const proposal = await db.proposal.findFirst({
    where: { id },
    select: {
      id: true,
      status: true,
      proposalNumber: true,
      sentAt: true,
    },
  });
  if (!proposal) {
    return { ok: false, error: "La propuesta no existe o no tienes acceso." };
  }
  if (proposal.status === data.status) {
    return { ok: false, error: "La propuesta ya está en ese estado." };
  }

  let returnReasonId: string | null = null;
  if (data.status === "DEVUELTA") {
    if (!data.returnReasonId) {
      return {
        ok: false,
        error: "Selecciona un motivo de devolución.",
        fieldErrors: { returnReasonId: "Motivo requerido" },
      };
    }
    const reason = await db.proposalReturnReason.findFirst({
      where: { id: data.returnReasonId },
      select: { id: true },
    });
    if (!reason) {
      return { ok: false, error: "Motivo de devolución inválido." };
    }
    returnReasonId = reason.id;
  }

  const setSentAt =
    data.status === "ENVIADA_COMPANIA" && proposal.sentAt === null;
  const nowSentAt = setSentAt ? new Date() : null;

  await db.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id },
      data: {
        status: data.status,
        currentStateStartedAt: new Date(),
        ...(setSentAt && nowSentAt ? { sentAt: nowSentAt } : {}),
      },
    });
    await tx.proposalStatusHistory.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId: id,
        status: data.status,
        note: emptyToNull(data.note),
        returnReasonId,
        changedById: ctx.userId,
      },
    });
    if (setSentAt && nowSentAt) {
      await tx.proposalLog.create({
        data: {
          organizationId: ctx.organizationId,
          proposalId: id,
          action: "STATUS_CHANGED_TO_ENVIADA",
          summary: "Estado cambiado a Enviada a la compañía",
          payload: { sentAt: nowSentAt.toISOString() },
          userId: ctx.userId,
        },
      });
    }
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "PROPOSAL",
    entityId: id,
    action: "status_changed",
    summary: `Propuesta ${proposal.proposalNumber}: ${STATUS_LABELS[data.status]}`,
    userId: ctx.userId,
  });

  revalidatePath("/propuestas");
  revalidatePath(`/propuestas/${id}`);
  return { ok: true, id };
}

/**
 * Reemplaza (delete-all + create-all) las participaciones de coaseguro y
 * co-corredor de una propuesta dentro de una transacción.
 */
// El tipo de tx producido por el cliente extendido (`getDb`) no es asignable
// a Prisma.TransactionClient; usamos any para evitar arrastrar la forma
// completa del tipo extendido.
async function replaceParticipations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  organizationId: string,
  proposalId: string,
  data: ProposalFormValues,
): Promise<void> {
  if (data.coaseguro) {
    await tx.proposalCoaseguroParticipation.deleteMany({
      where: { proposalId },
    });
    if (data.coaseguroParticipations.length > 0) {
      await tx.proposalCoaseguroParticipation.createMany({
        data: data.coaseguroParticipations.map((p) => ({
          organizationId,
          proposalId,
          insuranceCompanyId: p.insuranceCompanyId,
          participationPct: new Prisma.Decimal(p.participationPct),
          policyNumber: emptyToNull(p.policyNumber),
        })),
      });
    }
  } else {
    await tx.proposalCoaseguroParticipation.deleteMany({
      where: { proposalId },
    });
  }

  if (data.coCorredor) {
    await tx.proposalBrokerParticipation.deleteMany({
      where: { proposalId },
    });
    if (data.brokerParticipations.length > 0) {
      await tx.proposalBrokerParticipation.createMany({
        data: data.brokerParticipations.map((p) => ({
          organizationId,
          proposalId,
          brokerId: p.brokerId,
          participationPct: new Prisma.Decimal(p.participationPct),
        })),
      });
    }
  } else {
    await tx.proposalBrokerParticipation.deleteMany({ where: { proposalId } });
  }
}

/**
 * Guarda un borrador mínimo de propuesta (cliente + compañía + ramo) y
 * devuelve el id. El número de propuesta se asigna después vía
 * `assignProposalNumber` cuando se completan los datos requeridos.
 */
export async function saveProposalDraft(
  values: ProposalDraftValues & { proposalId?: string },
): Promise<ActionResult> {
  const parsed = proposalDraftSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] = issue.message;
    }
    return {
      ok: false,
      error: "Faltan datos mínimos para guardar borrador.",
      fieldErrors,
    };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  // Update si ya existe
  if (values.proposalId) {
    const existing = await db.proposal.findFirst({
      where: { id: values.proposalId },
      select: { id: true },
    });
    if (!existing) {
      return { ok: false, error: "Borrador no encontrado." };
    }
    await db.proposal.update({
      where: { id: values.proposalId },
      data: {
        clientId: data.clientId,
        companyId: data.insuranceCompanyId,
        branchTypeId: emptyToNull(data.branchTypeId),
        lineId: emptyToNull(data.lineId),
        branchId: emptyToNull(data.branchId),
      },
    });
    return { ok: true, id: values.proposalId };
  }

  // Crear borrador sin número de propuesta aún
  const created = await db.proposal.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: data.clientId,
      proposalNumber: `DRAFT-${Date.now()}`,
      companyId: data.insuranceCompanyId,
      branchTypeId: emptyToNull(data.branchTypeId),
      lineId: emptyToNull(data.lineId),
      branchId: emptyToNull(data.branchId),
      status: "ELABORACION",
      currency: "UF",
      currentStateStartedAt: new Date(),
      createdById: ctx.userId,
      assignedUserId: ctx.userId,
    },
    select: { id: true },
  });

  await db.proposalStatusHistory.create({
    data: {
      organizationId: ctx.organizationId,
      proposalId: created.id,
      status: "ELABORACION",
      note: "Borrador creado",
      changedById: ctx.userId,
    },
  });

  return { ok: true, id: created.id };
}

/**
 * Asigna definitivamente un número de propuesta usando el patrón configurado
 * por la organización. Idempotente: si ya hay un número que no es DRAFT-, no
 * hace nada.
 */
export async function assignProposalNumber(
  proposalId: string,
): Promise<ActionResult & { proposalNumber?: string }> {
  const { ctx, db } = await requireOrgDb();
  const existing = await db.proposal.findFirst({
    where: { id: proposalId },
    select: { id: true, proposalNumber: true },
  });
  if (!existing) return { ok: false, error: "Propuesta no encontrada." };
  if (existing.proposalNumber && !existing.proposalNumber.startsWith("DRAFT-")) {
    return { ok: true, id: proposalId, proposalNumber: existing.proposalNumber };
  }

  try {
    const proposalNumber = await generateProposalNumber(
      basePrisma,
      ctx.organizationId,
    );
    await db.proposal.update({
      where: { id: proposalId },
      data: { proposalNumber },
    });
    revalidatePath("/propuestas");
    revalidatePath(`/propuestas/${proposalId}`);
    return { ok: true, id: proposalId, proposalNumber };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "Conflicto al numerar. Intenta nuevamente." };
    }
    throw error;
  }
}

export type SendReservationResult =
  | { ok: true; to: string; days: number }
  | { ok: false; reason: "no_recipient" | "missing_data" | "send_failed"; error?: string };

/**
 * Envía la carta de reserva al contacto marcado como `isReservationRecipient`
 * en la compañía aseguradora de la propuesta. No lanza: registra el motivo
 * en `ProposalLog` y devuelve un resultado tipado.
 */
export async function sendReservationLetter(
  proposalId: string,
): Promise<SendReservationResult> {
  const { ctx, db } = await requireOrgDb();

  const org = await basePrisma.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { name: true, reservaDays: true },
  });
  if (!org) {
    return { ok: false, reason: "missing_data", error: "Organización no encontrada." };
  }

  const proposal = await db.proposal.findFirst({
    where: { id: proposalId },
    select: {
      id: true,
      proposalNumber: true,
      companyId: true,
      productId: true,
      startDate: true,
      endDate: true,
      client: { select: { name: true, rut: true } },
      branchType: { select: { name: true } },
    },
  });
  if (!proposal) {
    return { ok: false, reason: "missing_data", error: "Propuesta no encontrada." };
  }
  if (!proposal.companyId) {
    return { ok: false, reason: "missing_data", error: "La propuesta no tiene compañía." };
  }

  const product = proposal.productId
    ? await db.insuranceProduct.findFirst({
        where: { id: proposal.productId },
        select: { name: true },
      })
    : null;

  const recipient = await db.insuranceCompanyContact.findFirst({
    where: {
      insuranceCompanyId: proposal.companyId,
      isReservationRecipient: true,
      email: { not: null },
    },
    select: { email: true, name: true },
  });

  if (!recipient || !recipient.email) {
    await db.proposalLog.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId,
        action: "RESERVA_RECIPIENT_MISSING",
        summary:
          "No hay contacto de la compañía marcado para carta de reserva (o sin email).",
        userId: ctx.userId,
      },
    });
    return { ok: false, reason: "no_recipient" };
  }

  const vars = {
    proposalNumber: proposal.proposalNumber,
    contratanteName: proposal.client.name,
    contratanteRut: proposal.client.rut,
    ramoName: proposal.branchType?.name ?? "—",
    productoName: product?.name ?? "—",
    startDate: formatDate(proposal.startDate),
    endDate: formatDate(proposal.endDate),
    reservaDays: org.reservaDays,
    organizationName: org.name,
  };

  try {
    await sendEmail({
      to: recipient.email,
      subject: cartaReservaSubject(proposal.proposalNumber),
      text: cartaReservaText(vars),
      html: cartaReservaHtml(vars),
    });
  } catch (e) {
    await db.proposalLog.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId,
        action: "RESERVA_SEND_FAILED",
        summary: "Falló el envío de la carta de reserva.",
        payload: { error: e instanceof Error ? e.message : String(e) },
        userId: ctx.userId,
      },
    });
    return {
      ok: false,
      reason: "send_failed",
      error: e instanceof Error ? e.message : "Error al enviar.",
    };
  }

  await db.proposalLog.create({
    data: {
      organizationId: ctx.organizationId,
      proposalId,
      action: "EMAIL_RESERVA_SENT",
      summary: `Carta de reserva enviada a ${recipient.email}`,
      payload: { to: recipient.email, days: org.reservaDays },
      userId: ctx.userId,
    },
  });

  return { ok: true, to: recipient.email, days: org.reservaDays };
}

/**
 * Disparador: revisa requisitos (proposalNumber + companyId) y guarda contra
 * doble envío consultando el `ProposalLog` más reciente. No lanza: cualquier
 * error queda registrado en `ProposalLog`.
 */
async function maybeSendReservationLetter(proposalId: string): Promise<void> {
  try {
    const { db } = await requireOrgDb();
    const p = await db.proposal.findFirst({
      where: { id: proposalId },
      select: { proposalNumber: true, companyId: true, conReserva: true },
    });
    if (!p) return;
    if (!p.conReserva) return;
    if (!p.companyId) return;
    if (!p.proposalNumber || p.proposalNumber.startsWith("DRAFT-")) return;

    const last = await db.proposalLog.findFirst({
      where: { proposalId, action: "EMAIL_RESERVA_SENT" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (last) return; // ya se envió antes

    await sendReservationLetter(proposalId);
  } catch (e) {
    console.error("maybeSendReservationLetter error", e);
  }
}

export async function deleteProposalAction(id: string): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!canDeleteProposal(ctx.role)) {
    return { ok: false, error: "No tienes permiso para eliminar propuestas." };
  }

  const existing = await db.proposal.findFirst({
    where: { id },
    select: { id: true, proposalNumber: true },
  });
  if (!existing) {
    return { ok: false, error: "La propuesta no existe o no tienes acceso." };
  }

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "PROPOSAL",
    entityId: id,
    action: "deleted",
    summary: `Propuesta ${existing.proposalNumber} eliminada`,
    userId: ctx.userId,
  });
  await db.proposal.delete({ where: { id } });

  revalidatePath("/propuestas");
  return { ok: true, id };
}
