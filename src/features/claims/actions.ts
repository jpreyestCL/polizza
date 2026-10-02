"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, type ClaimLogKind } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { sanitizeRichText } from "@/lib/sanitize";
import { logActivity } from "@/server/activity";
import { canDeleteClaim } from "@/lib/roles";
import { hasPermission } from "@/lib/factory-roles";
import { sensitiveReasonError } from "@/lib/domain/sensitive-reason";
import {
  addCalendarDays,
  adjustmentLegalDeadline,
  canReopenClaim,
  canVoidClaim,
  claimTransitionError,
  closeDeadline,
  closedOnTime,
  closureOutcomeError,
  defaultSubstatus,
  disputeDeadline,
  isClaimOpen,
  substatusError,
  type ClaimStatusValue,
} from "@/lib/domain/claim-lifecycle";
import {
  claimStepDueDate,
  claimWorkflow,
  claimWorkflowFamily,
} from "@/lib/domain/claim-workflows";
import {
  searchPoliciesForClaim,
  getPolicyItemsForClaim,
  type PolicySearchResult,
} from "./queries";
import {
  claimIntakeSchema,
  claimDetailsSchema,
  claimCompanyInfoSchema,
  claimStatusChangeSchema,
  claimThirdPartySchema,
  claimNoteSchema,
  CLAIM_STATUS_LABELS,
  type ClaimIntakeValues,
  type ClaimDetailsValues,
  type ClaimCompanyInfoValues,
  type ClaimStatusChangeValues,
  type ClaimThirdPartyValues,
  type ClaimNoteValues,
} from "./schemas";

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

function tribool(value: string): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

const ADJUSTER_FOLLOWUP = "Pedir al liquidador el informe o la prórroga";

/** 45 días; 90 si la prima anual de la póliza supera 100 UF; 180 en casco. */
async function adjustmentContext(
  db: Awaited<ReturnType<typeof requireOrgDb>>["db"],
  claim: { policyId: string | null; branchTypeId: string | null },
): Promise<{ annualPremiumUf: number | null; hull: boolean }> {
  let annualPremiumUf: number | null = null;
  let hull = false;
  if (claim.policyId) {
    const policy = await db.policy.findFirst({
      where: { id: claim.policyId },
      select: { premiumNet: true, currency: true },
    });
    if (policy?.currency === "UF" && policy.premiumNet != null) {
      annualPremiumUf = Number(policy.premiumNet);
    }
  }
  if (claim.branchTypeId) {
    const branch = await db.branchType.findFirst({
      where: { id: claim.branchTypeId },
      select: { key: true, name: true },
    });
    const text = `${branch?.key ?? ""} ${branch?.name ?? ""}`.toLowerCase();
    hull = text.includes("casco") || text.includes("averia") || text.includes("avería");
  }
  return { annualPremiumUf, hull };
}

function intOrNull(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function logClaimEvent(params: {
  db: Awaited<ReturnType<typeof requireOrgDb>>["db"];
  organizationId: string;
  claimId: string;
  kind: ClaimLogKind;
  message: string;
  userId: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await params.db.claimLog.create({
    data: {
      organizationId: params.organizationId,
      claimId: params.claimId,
      kind: params.kind,
      message: params.message,
      userId: params.userId,
      ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
    },
  });
}

/** Crea el denuncio inicial a partir de la búsqueda póliza/item. */
export async function createClaimAction(
  values: ClaimIntakeValues,
): Promise<ActionResult> {
  const parsed = claimIntakeSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "claims.write")) {
    return { ok: false, error: "No tienes permiso para registrar siniestros." };
  }

  const policy = await db.policy.findFirst({
    where: { id: data.policyId },
    select: { id: true, clientId: true, policyNumber: true, proposalId: true },
  });
  if (!policy) {
    return { ok: false, error: "La póliza seleccionada no existe." };
  }

  // Reintenta hasta 5 veces ante colisiones de correlativo concurrentes.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const claim = await db.$transaction(async (tx) => {
        const last = await tx.claim.findFirst({
          orderBy: { folderNumber: "desc" },
          select: { folderNumber: true },
        });
        const folderNumber = (last?.folderNumber ?? 0) + 1;
        const claimNumber = `SIN-${new Date().getFullYear()}-${String(
          folderNumber,
        ).padStart(5, "0")}`;

        const created = await tx.claim.create({
          data: {
            organizationId: ctx.organizationId,
            clientId: policy.clientId,
            policyId: policy.id,
            policyItemId: emptyToNull(data.policyItemId),
            proposalItemId: emptyToNull(data.proposalItemId),
            branchTypeId: emptyToNull(data.branchTypeId),
            claimNumber,
            folderNumber,
            description: sanitizeRichText(data.description),
            status: "REPORTED",
            substatusCode: "REPORT_PENDING_SEND",
            closeDeadline: closeDeadline(new Date()),
            currency: "UF",
            assignedUserId: ctx.userId,
            createdById: ctx.userId,
            reportedAt: new Date(),
            reportedAtBroker: new Date(),
            currentStateStartedAt: new Date(),
          },
        });

        await tx.claimStatusHistory.create({
          data: {
            organizationId: ctx.organizationId,
            claimId: created.id,
            status: "REPORTED",
            note: "Aviso recibido. Falta enviarlo a la compañía.",
            changedById: ctx.userId,
          },
        });
        await tx.claimLog.create({
          data: {
            organizationId: ctx.organizationId,
            claimId: created.id,
            kind: "CREATED",
            message: `Denuncio creado sobre la póliza ${policy.policyNumber}`,
            userId: ctx.userId,
          },
        });
        const branchId = emptyToNull(data.branchTypeId);
        if (branchId) {
          const branch = await tx.branchType.findFirst({
            where: { id: branchId },
            select: { key: true, category: true },
          });
          const family = claimWorkflowFamily(branch?.key, branch?.category);
          if (family) {
            const openedAt = created.reportedAt ?? new Date();
            await tx.task.createMany({
              data: claimWorkflow(family).map((step) => ({
                organizationId: ctx.organizationId,
                title: step.action,
                description: step.alternative
                  ? `Alternativa: ${step.alternative}. Alerta a los ${step.alertDays ?? "—"} días.`
                  : step.alertDays == null
                    ? null
                    : `Alerta a los ${step.alertDays} días.`,
                entityType: "CLAIM" as const,
                entityId: created.id,
                assignedUserId: ctx.userId,
                dueDate: claimStepDueDate(openedAt, step.dueDays),
                priority: "MEDIA" as const,
                status: "PENDIENTE" as const,
                createdById: ctx.userId,
              })),
            });
          }
        }
        return created;
      });

      await logActivity(db, {
        organizationId: ctx.organizationId,
        entityType: "CLAIM",
        entityId: claim.id,
        action: "created",
        summary: `Siniestro ${claim.claimNumber} reportado sobre póliza ${policy.policyNumber}`,
        userId: ctx.userId,
      });

      revalidatePath("/siniestros");
      return { ok: true, id: claim.id };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  return {
    ok: false,
    error: "No se pudo asignar un número correlativo. Intenta nuevamente.",
  };
}

/** Actualiza los datos del denuncio (ingreso, denunciante, siniestro, ramo). */
export async function updateClaimDetailsAction(
  id: string,
  values: ClaimDetailsValues,
  branchData: Record<string, unknown>,
): Promise<ActionResult> {
  const parsed = claimDetailsSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const existing = await db.claim.findFirst({
    where: { id },
    select: { id: true, claimNumber: true, status: true },
  });
  if (!existing) {
    return { ok: false, error: "El siniestro no existe o no tienes acceso." };
  }
  if (
    (existing.status === "CLOSED" || existing.status === "VOID") &&
    !hasPermission(ctx.role, "claims.edit_closed")
  ) {
    return {
      ok: false,
      error: "Un siniestro cerrado o anulado solo se edita con permiso, o reabriendo el cerrado.",
    };
  }
  const notifiedAt = parseDate(data.reportedAtBroker);

  await db.claim.update({
    where: { id },
    data: {
      entryParty: data.entryParty === "" ? null : data.entryParty,
      entryChannel: data.entryChannel === "" ? null : data.entryChannel,
      reportedAtBroker: notifiedAt,
      ...(notifiedAt && isClaimOpen(existing.status)
        ? { closeDeadline: closeDeadline(notifiedAt) }
        : {}),

      reporterRut: emptyToNull(data.reporterRut),
      reporterFirstName: emptyToNull(data.reporterFirstName),
      reporterLastName: emptyToNull(data.reporterLastName),
      reporterPhone: emptyToNull(data.reporterPhone),
      reporterEmail: emptyToNull(data.reporterEmail),

      occurredAt: parseDate(data.occurredAt),
      occurredAtTime: emptyToNull(data.occurredAtTime),
      mainCoverageAffected: emptyToNull(data.mainCoverageAffected),
      policeReportDate: parseDate(data.policeReportDate),
      policeStation: emptyToNull(data.policeStation),
      policeReportFolio: emptyToNull(data.policeReportFolio),
      incidentCause: emptyToNull(data.incidentCause),
      incidentAddress: emptyToNull(data.incidentAddress),
      incidentCommune: emptyToNull(data.incidentCommune),
      incidentCity: emptyToNull(data.incidentCity),
      incidentNarrative: emptyToNull(sanitizeRichText(data.incidentNarrative)),

      lossType: data.lossType === "" ? null : data.lossType,
      smartDeductible: tribool(data.smartDeductible),
      hasAlcoholTest: tribool(data.hasAlcoholTest),
      driverAtFault: tribool(data.driverAtFault),
      driverFirstName: emptyToNull(data.driverFirstName),
      driverLastName: emptyToNull(data.driverLastName),
      driverRut: emptyToNull(data.driverRut),
      driverAge: intOrNull(data.driverAge),

      estimatedAmount: amount(data.estimatedAmount),
      settledAmount: amount(data.settledAmount),
      currency: data.currency,
      assignedUserId: emptyToNull(data.assignedUserId),
      description: sanitizeRichText(data.description),

      data: branchData as Prisma.InputJsonValue,
    },
  });

  await logClaimEvent({
    db,
    organizationId: ctx.organizationId,
    claimId: id,
    kind: "UPDATED",
    message: "Se actualizaron los datos del denuncio",
    userId: ctx.userId,
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLAIM",
    entityId: id,
    action: "updated",
    summary: `Siniestro ${existing.claimNumber} actualizado`,
    userId: ctx.userId,
  });

  revalidatePath("/siniestros");
  revalidatePath(`/siniestros/${id}`);
  return { ok: true, id };
}

/** Guarda número de siniestro de la compañía y/o liquidador asignado. */
export async function updateClaimCompanyInfoAction(
  id: string,
  values: ClaimCompanyInfoValues,
): Promise<ActionResult> {
  const parsed = claimCompanyInfoSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  if (!hasPermission(ctx.role, "claims.write")) {
    return { ok: false, error: "No tienes permiso para registrar el denuncio en la compañía." };
  }

  const existing = await db.claim.findFirst({
    where: { id },
    select: {
      id: true,
      claimNumber: true,
      companyClaimNumber: true,
      liquidatorName: true,
      filedAtCompanyAt: true,
      status: true,
      policyId: true,
      branchTypeId: true,
      adjustmentLegalDeadline: true,
    },
  });
  if (!existing) {
    return { ok: false, error: "El siniestro no existe o no tienes acceso." };
  }
  if (existing.status === "VOID" || existing.status === "CLOSED") {
    return { ok: false, error: "INVALID_TRANSITION: el denuncio cerrado o anulado no se reenvía." };
  }

  const newCompanyClaim = emptyToNull(data.companyClaimNumber);
  const newLiquidator = emptyToNull(data.liquidatorName);
  const newFiledAt = parseDate(data.filedAtCompanyAt);
  const preventive = tribool(data.isPreventive);
  const willAssign =
    Boolean(newCompanyClaim && newLiquidator) &&
    (existing.status === "AWAITING_ASSIGNMENT" ||
      (existing.status === "REPORTED" && Boolean(newFiledAt)));
  if (willAssign && preventive === null) {
    return {
      ok: false,
      error: "La asignación indica si el siniestro es preventivo.",
    };
  }

  const legalInput = await adjustmentContext(db, existing);
  const filedBase = newFiledAt ?? existing.filedAtCompanyAt;
  const legalDeadline = filedBase
    ? adjustmentLegalDeadline(filedBase, legalInput)
    : existing.adjustmentLegalDeadline;

  await db.claim.update({
    where: { id },
    data: {
      companyClaimNumber: newCompanyClaim,
      liquidatorName: newLiquidator,
      filedAtCompanyAt: newFiledAt,
      ...(preventive === null ? {} : { isPreventive: preventive }),
    },
  });

  if (newFiledAt && !existing.filedAtCompanyAt) {
    await logClaimEvent({
      db,
      organizationId: ctx.organizationId,
      claimId: id,
      kind: "COMPANY_FILED",
      message: "Denuncio enviado a la compañía",
      userId: ctx.userId,
    });
    if (existing.status === "REPORTED") {
      await db.$transaction([
        db.claim.update({
          where: { id },
          data: {
            status: "AWAITING_ASSIGNMENT",
            substatusCode: "AWAITING_INSURER_ASSIGNMENT",
            adjustmentLegalDeadline: legalDeadline,
            currentStateStartedAt: new Date(),
          },
        }),
        db.claimStatusHistory.create({
          data: {
            organizationId: ctx.organizationId,
            claimId: id,
            status: "AWAITING_ASSIGNMENT",
            note: "Denuncio enviado a la compañía",
            changedById: ctx.userId,
          },
        }),
      ]);
    }
  }
  const sentNow =
    Boolean(newFiledAt) && !existing.filedAtCompanyAt && existing.status === "REPORTED";
  const statusAfterSend = sentNow ? "AWAITING_ASSIGNMENT" : existing.status;
  if (newCompanyClaim && newLiquidator && statusAfterSend === "AWAITING_ASSIGNMENT") {
    const followUpOn = legalDeadline ? addCalendarDays(legalDeadline, -5) : null;
    await db.$transaction(async (tx) => {
      await tx.claim.update({
        where: { id },
        data: {
          status: "IN_ADJUSTMENT",
          substatusCode: "REPORTED_AND_ASSIGNED",
          isPreventive: preventive ?? false,
          currentStateStartedAt: new Date(),
        },
      });
      await tx.claimStatusHistory.create({
        data: {
          organizationId: ctx.organizationId,
          claimId: id,
          status: "IN_ADJUSTMENT",
          note: "La compañía asignó número y liquidador",
          changedById: ctx.userId,
        },
      });
      if (followUpOn) {
        await tx.task.create({
          data: {
            organizationId: ctx.organizationId,
            title: ADJUSTER_FOLLOWUP,
            description: "Cinco días antes del plazo legal del informe de liquidación.",
            entityType: "CLAIM",
            entityId: id,
            assignedUserId: ctx.userId,
            dueDate: followUpOn,
            priority: "ALTA",
            status: "PENDIENTE",
            createdById: ctx.userId,
          },
        });
      }
    });
  }
  if (newCompanyClaim && newCompanyClaim !== existing.companyClaimNumber) {
    await logClaimEvent({
      db,
      organizationId: ctx.organizationId,
      claimId: id,
      kind: "COMPANY_NUMBER_ASSIGNED",
      message: `La compañía asignó el N° ${newCompanyClaim}`,
      userId: ctx.userId,
    });
  }
  if (newLiquidator && newLiquidator !== existing.liquidatorName) {
    await logClaimEvent({
      db,
      organizationId: ctx.organizationId,
      claimId: id,
      kind: "LIQUIDATOR_ASSIGNED",
      message: `Liquidador asignado: ${newLiquidator}`,
      userId: ctx.userId,
    });
  }

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLAIM",
    entityId: id,
    action: "company_info_updated",
    summary: `Datos compañía actualizados para ${existing.claimNumber}`,
    userId: ctx.userId,
  });

  revalidatePath(`/siniestros/${id}`);
  revalidatePath("/siniestros");
  return { ok: true, id };
}

export async function changeClaimStatusAction(
  id: string,
  values: ClaimStatusChangeValues,
): Promise<ActionResult> {
  const parsed = claimStatusChangeSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Datos de cambio de estado inválidos." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();
  const needed = data.status === "CLOSED" ? "claims.close" : "claims.write";
  if (!hasPermission(ctx.role, needed)) {
    return {
      ok: false,
      error:
        data.status === "CLOSED"
          ? "No tienes permiso para cerrar el siniestro."
          : "No tienes permiso para mover el siniestro.",
    };
  }

  const claim = await db.claim.findFirst({
    where: { id },
    select: {
      id: true,
      status: true,
      claimNumber: true,
      voidedAt: true,
      companyClaimNumber: true,
      liquidatorName: true,
      filedAtCompanyAt: true,
      closeDeadline: true,
      policyId: true,
      branchTypeId: true,
      settledAmount: true,
      adjustmentLegalDeadline: true,
    },
  });
  if (!claim) {
    return { ok: false, error: "El siniestro no existe o no tienes acceso." };
  }
  if (claim.status === "VOID" || claim.voidedAt) {
    return {
      ok: false,
      error: "INVALID_TRANSITION: un siniestro anulado no se reabre. La anulación es terminal.",
    };
  }
  const transitionError = claimTransitionError(claim.status, data.status);
  if (transitionError) return { ok: false, error: transitionError };
  const filedAtCompanyAt =
    claim.filedAtCompanyAt ?? parseDate(data.filedAtCompanyAt);
  const companyClaimNumber =
    claim.companyClaimNumber || emptyToNull(data.companyClaimNumber);
  const liquidatorName = claim.liquidatorName || emptyToNull(data.liquidatorName);
  const settledRaw = data.settledAmount.trim().replace(",", ".");
  const settledAmount =
    claim.settledAmount != null && Number(claim.settledAmount) > 0
      ? claim.settledAmount
      : settledRaw
        ? settledRaw
        : null;
  if (data.status === "AWAITING_ASSIGNMENT" && !filedAtCompanyAt) {
    return {
      ok: false,
      error: "Indica la fecha en que el denuncio se envió a la compañía.",
    };
  }
  if (
    data.status === "IN_ADJUSTMENT" &&
    (!companyClaimNumber || !liquidatorName)
  ) {
    return {
      ok: false,
      error: "La asignación necesita el número de siniestro de la compañía y el liquidador.",
    };
  }
  if (data.status === "PAYMENT_PROCESS" && !(Number(settledAmount) > 0)) {
    return {
      ok: false,
      error: "El proceso de pago exige una indemnización mayor a cero.",
    };
  }
  if (data.status === "CLOSED") {
    const outcomeError = closureOutcomeError(claim.status, data.closureOutcome);
    if (outcomeError) return { ok: false, error: outcomeError };
  }

  const legalInput =
    data.status === "AWAITING_ASSIGNMENT"
      ? await adjustmentContext(db, claim)
      : null;
  const closing = data.status === "CLOSED" ? new Date() : null;
  await db.$transaction(async (tx) => {
    await tx.claim.update({
      where: { id },
      data: {
        status: data.status,
        substatusCode: defaultSubstatus(data.status as ClaimStatusValue),
        currentStateStartedAt: new Date(),
        ...(filedAtCompanyAt && !claim.filedAtCompanyAt
          ? { filedAtCompanyAt }
          : {}),
        ...(companyClaimNumber && !claim.companyClaimNumber
          ? { companyClaimNumber }
          : {}),
        ...(liquidatorName && !claim.liquidatorName ? { liquidatorName } : {}),
        ...(settledAmount != null &&
        !(claim.settledAmount != null && Number(claim.settledAmount) > 0)
          ? { settledAmount }
          : {}),
        ...(data.status === "AWAITING_ASSIGNMENT" && filedAtCompanyAt && legalInput
          ? {
              adjustmentLegalDeadline: adjustmentLegalDeadline(
                filedAtCompanyAt,
                legalInput,
              ),
            }
          : {}),
        ...(closing
          ? {
              closureOutcome: data.closureOutcome,
              closedAt: closing,
              closedOnTime: closedOnTime(closing, claim.closeDeadline),
            }
          : {}),
      },
    });
    if (data.status === "IN_ADJUSTMENT" && claim.adjustmentLegalDeadline) {
      const already = await tx.task.findFirst({
        where: { entityType: "CLAIM", entityId: id, title: ADJUSTER_FOLLOWUP },
        select: { id: true },
      });
      if (!already) {
        await tx.task.create({
          data: {
            organizationId: ctx.organizationId,
            title: ADJUSTER_FOLLOWUP,
            description: "Cinco días antes del plazo legal del informe de liquidación.",
            entityType: "CLAIM",
            entityId: id,
            assignedUserId: ctx.userId,
            dueDate: addCalendarDays(claim.adjustmentLegalDeadline, -5),
            priority: "ALTA",
            status: "PENDIENTE",
            createdById: ctx.userId,
          },
        });
      }
    }
    await tx.claimStatusHistory.create({
      data: {
        organizationId: ctx.organizationId,
        claimId: id,
        status: data.status,
        note: emptyToNull(sanitizeRichText(data.note)),
        changedById: ctx.userId,
      },
    });
    await tx.claimLog.create({
      data: {
        organizationId: ctx.organizationId,
        claimId: id,
        kind: "STATUS_CHANGED",
        message: `Estado: ${CLAIM_STATUS_LABELS[data.status]}${
          data.note ? ` — ${data.note}` : ""
        }`,
        userId: ctx.userId,
      },
    });
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLAIM",
    entityId: id,
    action: "status_changed",
    summary: `Siniestro ${claim.claimNumber}: ${CLAIM_STATUS_LABELS[data.status]}`,
    userId: ctx.userId,
  });

  revalidatePath("/siniestros");
  revalidatePath(`/siniestros/${id}`);
  return { ok: true, id };
}

export async function addClaimThirdPartyAction(
  claimId: string,
  values: ClaimThirdPartyValues,
): Promise<ActionResult> {
  const parsed = claimThirdPartySchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del tercero." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const claim = await db.claim.findFirst({
    where: { id: claimId },
    select: { id: true, claimNumber: true },
  });
  if (!claim) {
    return { ok: false, error: "El siniestro no existe o no tienes acceso." };
  }

  const tp = await db.claimThirdParty.create({
    data: {
      organizationId: ctx.organizationId,
      claimId,
      involvesVehicle: data.involvesVehicle,
      firstName: emptyToNull(data.firstName),
      lastName: emptyToNull(data.lastName),
      rut: emptyToNull(data.rut),
      phone: emptyToNull(data.phone),
      email: emptyToNull(data.email),
      vehicleType: emptyToNull(data.vehicleType),
      vehicleBrand: emptyToNull(data.vehicleBrand),
      vehicleModel: emptyToNull(data.vehicleModel),
      vehicleYear: intOrNull(data.vehicleYear),
      plate: emptyToNull(data.plate),
      engineNumber: emptyToNull(data.engineNumber),
      chassisNumber: emptyToNull(data.chassisNumber),
      hasInsurance: tribool(data.hasInsurance),
      insuranceCompany: emptyToNull(data.insuranceCompany),
      policyNumber: emptyToNull(data.policyNumber),
      atFault: tribool(data.atFault),
      damagedGoodsDescription: emptyToNull(sanitizeRichText(data.damagedGoodsDescription)),
    },
  });

  const who =
    [data.firstName, data.lastName].filter(Boolean).join(" ").trim() ||
    data.rut ||
    "Tercero";

  await logClaimEvent({
    db,
    organizationId: ctx.organizationId,
    claimId,
    kind: "THIRD_PARTY_ADDED",
    message: `Tercero agregado: ${who}`,
    userId: ctx.userId,
  });

  revalidatePath(`/siniestros/${claimId}`);
  return { ok: true, id: tp.id };
}

export async function deleteClaimThirdPartyAction(
  claimId: string,
  thirdPartyId: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  const tp = await db.claimThirdParty.findFirst({
    where: { id: thirdPartyId, claimId },
    select: { id: true, firstName: true, lastName: true, rut: true },
  });
  if (!tp) {
    return { ok: false, error: "Tercero no encontrado." };
  }
  await db.claimThirdParty.delete({ where: { id: thirdPartyId } });
  const who =
    [tp.firstName, tp.lastName].filter(Boolean).join(" ").trim() ||
    tp.rut ||
    "Tercero";
  await logClaimEvent({
    db,
    organizationId: ctx.organizationId,
    claimId,
    kind: "THIRD_PARTY_REMOVED",
    message: `Tercero eliminado: ${who}`,
    userId: ctx.userId,
  });
  revalidatePath(`/siniestros/${claimId}`);
  return { ok: true, id: thirdPartyId };
}

export async function addClaimNoteAction(
  claimId: string,
  values: ClaimNoteValues,
): Promise<ActionResult> {
  const parsed = claimNoteSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Escribe una nota válida." };
  }
  const { ctx, db } = await requireOrgDb();
  const claim = await db.claim.findFirst({
    where: { id: claimId },
    select: { id: true },
  });
  if (!claim) {
    return { ok: false, error: "El siniestro no existe o no tienes acceso." };
  }
  const note = await db.claimLog.create({
    data: {
      organizationId: ctx.organizationId,
      claimId,
      kind: "NOTE",
      message: sanitizeRichText(parsed.data.message),
      userId: ctx.userId,
    },
  });
  revalidatePath(`/siniestros/${claimId}`);
  return { ok: true, id: note.id };
}

export async function deleteClaimAction(id: string): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!canDeleteClaim(ctx.role)) {
    return { ok: false, error: "No tienes permiso para eliminar siniestros." };
  }
  const existing = await db.claim.findFirst({
    where: { id },
    select: { id: true, claimNumber: true },
  });
  if (!existing) {
    return { ok: false, error: "El siniestro no existe o no tienes acceso." };
  }
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLAIM",
    entityId: id,
    action: "deleted",
    summary: `Siniestro ${existing.claimNumber} eliminado`,
    userId: ctx.userId,
  });
  await db.claim.delete({ where: { id } });
  revalidatePath("/siniestros");
  return { ok: true, id };
}

// Server actions auxiliares para el wizard de creación
export async function voidClaimFormAction(form: FormData): Promise<void> {
  const id = String(form.get("claimId") ?? "");
  const reason = String(form.get("reason") ?? "");
  const reasonError = sensitiveReasonError(reason);
  if (reasonError) {
    redirect(`/siniestros/${id}?aviso=${encodeURIComponent(reasonError)}`);
  }
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "claims.void")) {
    redirect(`/siniestros/${id}?aviso=${encodeURIComponent("No tienes permiso para anular el siniestro.")}`);
  }
  const claim = await db.claim.findFirst({
    where: { id },
    select: { id: true, claimNumber: true, status: true, voidedAt: true },
  });
  if (!claim) redirect(`/siniestros/${id}?aviso=${encodeURIComponent("El siniestro no existe.")}`);
  if (!canVoidClaim(claim.status) || claim.voidedAt) {
    redirect(
      `/siniestros/${id}?aviso=${encodeURIComponent("INVALID_TRANSITION: solo se anula un aviso que todavía no está en liquidación.")}`,
    );
  }
  await db.claim.update({
    where: { id },
    data: { status: "VOID", voidedAt: new Date(), voidReason: reason.trim() },
  });
  await db.claimStatusHistory.create({
    data: {
      organizationId: ctx.organizationId,
      claimId: id,
      status: "VOID",
      note: reason.trim(),
      changedById: ctx.userId,
    },
  });
  await db.claimLog.create({
    data: {
      organizationId: ctx.organizationId,
      claimId: id,
      kind: "NOTE",
      message: `Anulado. ${reason.trim()}`,
      userId: ctx.userId,
    },
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLAIM",
    entityId: id,
    action: "voided",
    summary: `Siniestro ${claim.claimNumber} anulado. ${reason.trim()}`,
    userId: ctx.userId,
  });
  revalidatePath(`/siniestros/${id}`);
  redirect(`/siniestros/${id}?aviso=${encodeURIComponent("Siniestro anulado.")}`);
}

export async function reopenClaimFormAction(form: FormData): Promise<void> {
  const id = String(form.get("claimId") ?? "");
  const reason = String(form.get("reason") ?? "");
  const reasonError = sensitiveReasonError(reason);
  if (reasonError) {
    redirect(`/siniestros/${id}?aviso=${encodeURIComponent(reasonError)}`);
  }
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "claims.reopen")) {
    redirect(`/siniestros/${id}?aviso=${encodeURIComponent("No tienes permiso para reabrir el siniestro.")}`);
  }
  const target = String(form.get("target") ?? "IN_ADJUSTMENT");
  const claim = await db.claim.findFirst({
    where: { id },
    select: { id: true, claimNumber: true, status: true, reopenCount: true },
  });
  if (!claim) redirect(`/siniestros/${id}?aviso=${encodeURIComponent("El siniestro no existe.")}`);
  if (!canReopenClaim(claim.status)) {
    redirect(
      `/siniestros/${id}?aviso=${encodeURIComponent("INVALID_TRANSITION: solo se reabre un siniestro cerrado. El anulado no vuelve.")}`,
    );
  }
  if (target !== "IN_ADJUSTMENT" && target !== "PAYMENT_PROCESS") {
    redirect(`/siniestros/${id}?aviso=${encodeURIComponent("El nuevo estado tiene que ser liquidación o proceso de pago.")}`);
  }
  await db.claim.update({
    where: { id },
    data: {
      reopenedAt: new Date(),
      reopenCount: claim.reopenCount + 1,
      status: target,
      substatusCode: defaultSubstatus(target),
      closedAt: null,
      closedOnTime: null,
      closureOutcome: null,
      currentStateStartedAt: new Date(),
    },
  });
  await db.claimStatusHistory.create({
    data: {
      organizationId: ctx.organizationId,
      claimId: id,
      status: target,
      note: reason.trim(),
      changedById: ctx.userId,
    },
  });
  await db.claimLog.create({
    data: {
      organizationId: ctx.organizationId,
      claimId: id,
      kind: "NOTE",
      message: `Reabierto. ${reason.trim()}`,
      userId: ctx.userId,
    },
  });
  revalidatePath(`/siniestros/${id}`);
  redirect(`/siniestros/${id}?aviso=${encodeURIComponent("Siniestro reabierto.")}`);
}

export async function setClaimSubstatusAction(form: FormData): Promise<void> {
  const id = String(form.get("claimId") ?? "");
  const substatus = String(form.get("substatus") ?? "");
  const reportOn = String(form.get("finalReportOn") ?? "");
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "claims.write")) {
    redirect(`/siniestros/${id}?aviso=${encodeURIComponent("No tienes permiso para liquidar el siniestro.")}`);
  }
  const claim = await db.claim.findFirst({
    where: { id },
    select: { id: true, status: true },
  });
  if (!claim || !isClaimOpen(claim.status)) {
    redirect(`/siniestros/${id}?aviso=${encodeURIComponent("INVALID_TRANSITION: el subestado solo cambia en un siniestro abierto.")}`);
  }
  const error = substatusError(claim.status, substatus);
  if (error) redirect(`/siniestros/${id}?aviso=${encodeURIComponent(error)}`);
  const reportDate = reportOn ? new Date(`${reportOn}T00:00:00.000Z`) : null;
  if (reportOn && (!reportDate || Number.isNaN(reportDate.getTime()))) {
    redirect(`/siniestros/${id}?aviso=${encodeURIComponent("La fecha del informe final no es válida.")}`);
  }
  await db.claim.update({
    where: { id },
    data: {
      substatusCode: substatus,
      isDisputed: substatus === "DISPUTED",
      ...(reportDate
        ? {
            finalReportReceivedAt: reportDate,
            disputeDeadline: disputeDeadline(reportDate),
          }
        : {}),
    },
  });
  revalidatePath(`/siniestros/${id}`);
  redirect(`/siniestros/${id}?aviso=${encodeURIComponent("Subestado actualizado.")}`);
}

export async function extendAdjustmentAction(form: FormData): Promise<void> {
  const id = String(form.get("claimId") ?? "");
  const reason = String(form.get("reason") ?? "");
  const next = String(form.get("newDeadline") ?? "");
  const reasonError = sensitiveReasonError(reason);
  if (reasonError) {
    redirect(`/siniestros/${id}?aviso=${encodeURIComponent(reasonError)}`);
  }
  const newDeadline = new Date(`${next}T00:00:00.000Z`);
  if (!next || Number.isNaN(newDeadline.getTime())) {
    redirect(`/siniestros/${id}?aviso=${encodeURIComponent("La prórroga necesita una fecha.")}`);
  }
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "claims.write")) {
    redirect(`/siniestros/${id}?aviso=${encodeURIComponent("No tienes permiso para prorrogar la liquidación.")}`);
  }
  const claim = await db.claim.findFirst({
    where: { id },
    select: { id: true, status: true, adjustmentLegalDeadline: true },
  });
  if (!claim || !isClaimOpen(claim.status) || !claim.adjustmentLegalDeadline) {
    redirect(`/siniestros/${id}?aviso=${encodeURIComponent("La prórroga aplica cuando ya hay un plazo legal de liquidación.")}`);
  }
  if (newDeadline.getTime() <= claim.adjustmentLegalDeadline.getTime()) {
    redirect(`/siniestros/${id}?aviso=${encodeURIComponent("La nueva fecha tiene que ser posterior al plazo vigente.")}`);
  }
  await db.claimAdjustmentExtension.create({
    data: {
      organizationId: ctx.organizationId,
      claimId: id,
      requestedOn: new Date(),
      previousDeadline: claim.adjustmentLegalDeadline,
      newDeadline,
      reason: reason.trim(),
      createdById: ctx.userId,
    },
  });
  await db.claim.update({
    where: { id },
    data: { adjustmentLegalDeadline: newDeadline },
  });
  revalidatePath(`/siniestros/${id}`);
  redirect(`/siniestros/${id}?aviso=${encodeURIComponent("Prórroga registrada. El plazo legal quedó en la fecha nueva.")}`);
}

export async function searchPoliciesForClaimAction(
  query: string,
  includeNonActive: boolean,
): Promise<PolicySearchResult[]> {
  const { ctx, db } = await requireOrgDb();
  return searchPoliciesForClaim(ctx, db, { query, includeNonActive });
}

export async function getPolicyItemsForClaimAction(policyId: string) {
  const { db } = await requireOrgDb();
  return getPolicyItemsForClaim(db, policyId);
}

