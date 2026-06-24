"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { basePrisma } from "@/server/db";
import { logActivity } from "@/server/activity";
import { canDeleteProposal } from "@/lib/roles";
import { sanitizeRichText } from "@/lib/sanitize";
import { sendEmail, emailLayout } from "@/server/email";
import { readStoredFile } from "@/server/storage";
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
  policyReceptionSchema,
  emissionErrorSchema,
  policyDispatchSchema,
  STATUS_LABELS,
  isProposalLocked,
  type ProposalFormValues,
  type ProposalDraftValues,
  type StatusChangeValues,
  type PolicyReceptionValues,
  type EmissionErrorValues,
  type PolicyDispatchValues,
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
          startTime: emptyToNull(data.startTime),
          endTime: emptyToNull(data.endTime),
          sentAt: parseDate(data.sentAt),
          recipientEmail: emptyToNull(data.recipientEmail),
          recipientContactId: emptyToNull(data.recipientContactId),
          contratanteEmail: emptyToNull(data.contratanteEmail),
          contratantePhone: emptyToNull(data.contratantePhone),
          contratanteCelular: emptyToNull(data.contratanteCelular),
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
      startTime: emptyToNull(data.startTime),
      endTime: emptyToNull(data.endTime),
      sentAt: parseDate(data.sentAt),
      recipientEmail: emptyToNull(data.recipientEmail),
      recipientContactId: emptyToNull(data.recipientContactId),
      contratanteEmail: emptyToNull(data.contratanteEmail),
      contratantePhone: emptyToNull(data.contratantePhone),
      contratanteCelular: emptyToNull(data.contratanteCelular),
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
  // "Por despachar" se asigna automáticamente al registrar la recepción de la
  // póliza emitida; no es un destino manual (review #2). Evita que un arrastre
  // en el kanban deje la propuesta sin N° de póliza y atascada en el flujo.
  if (data.status === "POR_DESPACHAR") {
    return {
      ok: false,
      error:
        "El estado “Por despachar” se asigna al registrar la recepción de la póliza emitida, no manualmente.",
    };
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
        productId: emptyToNull(data.productId),
        insuredClientId: emptyToNull(data.insuredClientId),
        beneficiaryClientId: emptyToNull(data.beneficiaryClientId),
        commissionAffectPct: decimalOrNull(data.commissionAffectPct),
        commissionExemptPct: decimalOrNull(data.commissionExemptPct),
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
      productId: emptyToNull(data.productId),
      insuredClientId: emptyToNull(data.insuredClientId),
      beneficiaryClientId: emptyToNull(data.beneficiaryClientId),
      commissionAffectPct: decimalOrNull(data.commissionAffectPct),
      commissionExemptPct: decimalOrNull(data.commissionExemptPct),
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

/**
 * Registra la recepción de la póliza emitida correctamente por la compañía:
 * Nº de póliza, fecha de emisión y de recepción. La propuesta pasa a
 * POR_DESPACHAR (obs 8). El documento PDF de la póliza se adjunta aparte
 * (Documentos).
 */
export async function registerPolicyEmissionAction(
  proposalId: string,
  values: PolicyReceptionValues,
): Promise<ActionResult> {
  const parsed = policyReceptionSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const proposal = await db.proposal.findFirst({
    where: { id: proposalId },
    select: { id: true, proposalNumber: true },
  });
  if (!proposal) {
    return { ok: false, error: "La propuesta no existe o no tienes acceso." };
  }

  // Obs 15: no se puede dejar la póliza en estado Emitida sin haber subido el
  // PDF de la póliza (documento de tipo "Póliza" adjunto a la propuesta).
  const policyDoc = await db.document.findFirst({
    where: {
      entityType: "PROPOSAL",
      entityId: proposalId,
      documentType: "Póliza",
    },
    select: { id: true },
  });
  if (!policyDoc) {
    return {
      ok: false,
      error:
        "Debes subir el PDF de la póliza (documento tipo “Póliza” en la pestaña Documentos) antes de dejarla por despachar.",
    };
  }

  await db.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposalId },
      data: {
        status: "POR_DESPACHAR",
        currentStateStartedAt: new Date(),
        policyNumberGenerated: data.policyNumber.trim(),
        policyEmissionDate: parseDate(data.emissionDate),
        policyReceptionDate: parseDate(data.receptionDate),
        emissionErrorReason: null,
        emissionErrorDetail: null,
      },
    });
    await tx.proposalStatusHistory.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId,
        status: "POR_DESPACHAR",
        note:
          emptyToNull(data.note) ??
          `Póliza N° ${data.policyNumber.trim()} emitida por la compañía`,
        changedById: ctx.userId,
      },
    });
    await tx.proposalLog.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId,
        action: "POLICY_EMITTED",
        summary: `Póliza N° ${data.policyNumber.trim()} emitida por la compañía`,
        payload: {
          policyNumber: data.policyNumber.trim(),
          emissionDate: data.emissionDate,
          receptionDate: data.receptionDate,
        },
        userId: ctx.userId,
      },
    });
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "PROPOSAL",
    entityId: proposalId,
    action: "policy_emitted",
    summary: `Propuesta ${proposal.proposalNumber}: póliza N° ${data.policyNumber.trim()} emitida`,
    userId: ctx.userId,
  });

  revalidatePath("/propuestas");
  revalidatePath(`/propuestas/${proposalId}`);
  return { ok: true, id: proposalId };
}

/**
 * Registra que la compañía emitió la póliza con un error: la propuesta queda
 * DEVUELTA ("devuelta a la compañía") con el motivo del error de emisión.
 */
export async function registerEmissionErrorAction(
  proposalId: string,
  values: EmissionErrorValues,
): Promise<ActionResult> {
  const parsed = emissionErrorSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const proposal = await db.proposal.findFirst({
    where: { id: proposalId },
    select: { id: true, proposalNumber: true },
  });
  if (!proposal) {
    return { ok: false, error: "La propuesta no existe o no tienes acceso." };
  }

  await db.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposalId },
      data: {
        status: "DEVUELTA",
        currentStateStartedAt: new Date(),
        // Obs 16: registra el N° de póliza generado (erróneo) y la fecha de
        // recepción aun cuando la emisión vino con error.
        policyNumberGenerated: data.policyNumber.trim(),
        policyReceptionDate: parseDate(data.receptionDate),
        emissionErrorReason: data.reason,
        emissionErrorDetail: emptyToNull(data.detail),
      },
    });
    await tx.proposalStatusHistory.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId,
        status: "DEVUELTA",
        note: `Devuelta a la compañía · Póliza N° ${data.policyNumber.trim()} · ${data.reason}${
          data.detail ? ` — ${data.detail}` : ""
        }`,
        changedById: ctx.userId,
      },
    });
    await tx.proposalLog.create({
      data: {
        organizationId: ctx.organizationId,
        proposalId,
        action: "EMISSION_ERROR",
        summary: `Devuelta a la compañía por error de emisión: ${data.reason}`,
        payload: {
          reason: data.reason,
          detail: data.detail,
          policyNumber: data.policyNumber.trim(),
          receptionDate: data.receptionDate,
        },
        userId: ctx.userId,
      },
    });
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "PROPOSAL",
    entityId: proposalId,
    action: "emission_error",
    summary: `Propuesta ${proposal.proposalNumber}: devuelta a la compañía (${data.reason})`,
    userId: ctx.userId,
  });

  revalidatePath("/propuestas");
  revalidatePath(`/propuestas/${proposalId}`);
  return { ok: true, id: proposalId };
}

/**
 * Despacho de la póliza al contratante (obs 9, 19-20). Cuando la póliza está
 * recepcionada (POR_DESPACHAR) ofrece dos caminos:
 *  - enviar la póliza al contratante por email (mail tipo) con la póliza
 *    adjunta + documentos seleccionados de la carátula, o
 *  - marcarla como despachada sin enviar.
 * En ambos casos se crea automáticamente la Policy en la cartera (usando los
 * datos de la propuesta) y la propuesta sale del flujo de propuestas para
 * vivir en la sección "Pólizas".
 */
export async function dispatchPolicyToContratanteAction(
  proposalId: string,
  values: PolicyDispatchValues,
): Promise<ActionResult> {
  const parsed = policyDispatchSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const proposal = await db.proposal.findFirst({
    where: { id: proposalId },
    select: {
      id: true,
      proposalNumber: true,
      status: true,
      clientId: true,
      companyId: true,
      lineId: true,
      branchId: true,
      currency: true,
      startDate: true,
      endDate: true,
      assignedUserId: true,
      premiumNet: true,
      policyNumberGenerated: true,
      contratanteEmail: true,
      client: { select: { name: true, email: true } },
    },
  });
  if (!proposal) {
    return { ok: false, error: "La propuesta no existe o no tienes acceso." };
  }
  if (proposal.status !== "POR_DESPACHAR") {
    return {
      ok: false,
      error: "Solo se puede despachar una póliza que está por despachar.",
    };
  }
  if (!proposal.policyNumberGenerated) {
    return {
      ok: false,
      error:
        "Falta el N° de póliza generado. Registra la recepción de la póliza antes de despacharla.",
    };
  }
  const policyNumber = proposal.policyNumberGenerated.trim();

  // Guarda de re-despacho: si la propuesta ya tiene una póliza en la cartera no
  // se vuelve a crear ni se reenvía el correo (review #4/#7).
  const alreadyDispatched = await db.policy.findFirst({
    where: { proposalId },
    select: { id: true },
  });
  if (alreadyDispatched) {
    return {
      ok: false,
      error: "Esta propuesta ya fue despachada y tiene una póliza en la cartera.",
    };
  }

  // El email se valida acá pero se ENVÍA después de crear la póliza (review #3):
  // así nunca le llega el correo al contratante si la creación de la póliza falla.
  const recipient = data.send
    ? data.toEmail.trim() ||
      proposal.contratanteEmail?.trim() ||
      proposal.client.email?.trim() ||
      ""
    : "";
  if (data.send && !recipient) {
    return {
      ok: false,
      error:
        "No hay email del contratante. Indícalo o agrégalo en la ficha/propuesta.",
    };
  }

  // Datos de ítems/coberturas para crear la póliza (mismo criterio que la
  // antigua conversión manual en /polizas/nuevo). No se deduplican coberturas
  // por nombre: cada ítem aporta las suyas con su monto (review #5).
  const proposalItems = await db.proposalItem.findMany({
    where: { proposalId },
    orderBy: { order: "asc" },
    include: {
      branchType: { select: { name: true } },
      coverages: { orderBy: { order: "asc" } },
    },
  });

  // La prima neta SIEMPRE suma todas las coberturas; la casilla "Suma" solo
  // afecta el monto asegurado del ítem (ver obs).
  const totalNet = proposalItems.reduce(
    (sum, it) =>
      sum +
      it.coverages.reduce(
        (s, c) => s + (c.premiumNet ? Number(c.premiumNet) : 0),
        0,
      ),
    0,
  );

  let policyId: string;
  try {
    policyId = await db.$transaction(async (tx) => {
      const policy = await tx.policy.create({
        data: {
          organizationId: ctx.organizationId,
          clientId: proposal.clientId,
          proposalId,
          policyNumber,
          companyId: proposal.companyId,
          lineId: proposal.lineId,
          branchId: proposal.branchId,
          status: "VIGENTE",
          premiumNet:
            totalNet > 0 ? new Prisma.Decimal(totalNet) : proposal.premiumNet,
          currency: proposal.currency,
          startDate: proposal.startDate,
          endDate: proposal.endDate,
          assignedUserId: proposal.assignedUserId ?? ctx.userId,
          createdById: ctx.userId,
        },
      });

      const itemsData = proposalItems.map((it) => {
        const itData = (it.data ?? {}) as Record<string, unknown>;
        const summary =
          it.identification ??
          (typeof itData.patente === "string" ? itData.patente : null) ??
          (typeof itData.direccion === "string" ? itData.direccion : null) ??
          it.branchType.name;
        const insuredAmount = it.coverages
          .filter((c) => c.sumsToTotal)
          .reduce((s, c) => s + (c.insuredAmount ? Number(c.insuredAmount) : 0), 0);
        return {
          organizationId: ctx.organizationId,
          policyId: policy.id,
          description: summary,
          insuredAmount:
            insuredAmount > 0 ? new Prisma.Decimal(insuredAmount) : null,
          currency: proposal.currency,
        };
      });
      if (itemsData.length > 0) {
        await tx.policyItem.createMany({ data: itemsData });
      }

      const coveragesData = proposalItems.flatMap((it) =>
        it.coverages.map((c) => ({
          organizationId: ctx.organizationId,
          policyId: policy.id,
          name: c.name,
          insuredAmount: c.insuredAmount,
          currency: proposal.currency,
        })),
      );
      if (coveragesData.length > 0) {
        await tx.policyCoverage.createMany({ data: coveragesData });
      }

      await tx.policyStatusHistory.create({
        data: {
          organizationId: ctx.organizationId,
          policyId: policy.id,
          status: "VIGENTE",
          note: `Póliza ${policy.policyNumber} despachada desde la propuesta ${proposal.proposalNumber}`,
          changedById: ctx.userId,
        },
      });

      // Plan de pago + cuotas de la propuesta → quedan vinculados a la póliza.
      const plan = await tx.paymentPlan.findUnique({
        where: { proposalId },
        select: { id: true },
      });
      if (plan) {
        await tx.paymentPlan.update({
          where: { id: plan.id },
          data: { policyId: policy.id },
        });
        await tx.installment.updateMany({
          where: { paymentPlanId: plan.id, policyId: null },
          data: { policyId: policy.id },
        });
      }

      // La propuesta no cambia de estado (queda POR_DESPACHAR), pero al tener
      // una póliza vinculada deja de aparecer en el flujo de propuestas.
      await tx.proposal.update({
        where: { id: proposalId },
        data: { currentStateStartedAt: new Date() },
      });
      await tx.proposalLog.create({
        data: {
          organizationId: ctx.organizationId,
          proposalId,
          action: "POLICY_DISPATCHED",
          summary: data.send
            ? `Póliza ${policyNumber} enviada al contratante y despachada a la cartera`
            : `Póliza ${policyNumber} marcada como despachada y registrada en la cartera`,
          userId: ctx.userId,
        },
      });
      return policy.id;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: `Ya existe una póliza con el número ${policyNumber}. Edítalo en la recepción antes de despachar.`,
      };
    }
    throw error;
  }

  // La póliza ya está en la cartera: ahora se envía el correo (review #3). Si el
  // envío falla, la póliza queda creada igual y el operador reenvía desde ella.
  if (data.send) {
    const org = await basePrisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { name: true },
    });
    const orgName = org?.name ?? "Polizza";

    // Documentos: la póliza (tipo "Póliza") siempre + los seleccionados de la
    // carátula. Los subidos al servidor se adjuntan; los de enlace externo se
    // listan como links en el cuerpo.
    const policyDocs = await db.document.findMany({
      where: {
        entityType: "PROPOSAL",
        entityId: proposalId,
        documentType: "Póliza",
      },
      select: { id: true, fileName: true, fileUrl: true, storageKey: true, mimeType: true },
    });
    const selected = data.documentIds.length
      ? await db.document.findMany({
          where: {
            id: { in: data.documentIds },
            entityType: "PROPOSAL",
            entityId: proposalId,
          },
          select: { id: true, fileName: true, fileUrl: true, storageKey: true, mimeType: true },
        })
      : [];
    const byId = new Map<string, (typeof policyDocs)[number]>();
    for (const d of [...policyDocs, ...selected]) byId.set(d.id, d);
    const allDocs = Array.from(byId.values());

    const attachments: { filename: string; content: Buffer; contentType?: string }[] = [];
    const linkDocs: { fileName: string; fileUrl: string }[] = [];
    for (const d of allDocs) {
      if (d.storageKey) {
        const bytes = await readStoredFile(d.storageKey);
        if (bytes) {
          attachments.push({
            filename: d.fileName,
            content: bytes,
            contentType: d.mimeType ?? undefined,
          });
          continue;
        }
      }
      if (d.fileUrl) linkDocs.push({ fileName: d.fileName, fileUrl: d.fileUrl });
    }

    const subject =
      data.subject.trim() || `Póliza N° ${policyNumber} · ${orgName}`;
    const bodyText =
      data.body.trim() ||
      `Estimado(a) ${proposal.client.name},\n\nAdjuntamos su póliza N° ${policyNumber}. Ante cualquier consulta, quedamos a su disposición.\n\nLe saluda atentamente,\n${orgName}`;
    const docsHtml =
      linkDocs.length > 0
        ? `<p style="font-size:13px;margin-top:12px"><b>Documentos por enlace:</b></p><ul style="font-size:13px">${linkDocs
            .map(
              (d) =>
                `<li><a href="${d.fileUrl}" target="_blank">${d.fileName}</a></li>`,
            )
            .join("")}</ul>`
        : "";
    const html = emailLayout(
      subject,
      bodyText
        .split("\n")
        .map((l) => `<div>${escapeHtmlLite(l) || "&nbsp;"}</div>`)
        .join("") + docsHtml,
    );

    try {
      await sendEmail({
        to: recipient,
        subject,
        text:
          bodyText +
          (linkDocs.length > 0
            ? "\n\nDocumentos por enlace:\n" +
              linkDocs.map((d) => `- ${d.fileName}: ${d.fileUrl}`).join("\n")
            : ""),
        html,
        attachments,
      });
    } catch (e) {
      revalidatePath("/propuestas");
      revalidatePath("/polizas");
      revalidatePath(`/propuestas/${proposalId}`);
      return {
        ok: false,
        error: `La póliza N° ${policyNumber} se creó en la cartera, pero falló el envío del correo: ${
          e instanceof Error ? e.message : "error desconocido"
        }. Reenvíalo desde la póliza.`,
      };
    }
  }

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "PROPOSAL",
    entityId: proposalId,
    action: "policy_dispatched",
    summary: `Propuesta ${proposal.proposalNumber}: póliza despachada a la cartera`,
    userId: ctx.userId,
  });

  revalidatePath("/propuestas");
  revalidatePath("/polizas");
  revalidatePath(`/propuestas/${proposalId}`);
  return { ok: true, id: policyId };
}

function escapeHtmlLite(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
