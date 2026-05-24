"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type ClaimLogKind } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { logActivity } from "@/server/activity";
import { canDeleteClaim } from "@/lib/roles";
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
            description: data.description,
            status: "REPORTADO",
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
            status: "REPORTADO",
            note: "Siniestro reportado",
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
    select: { id: true, claimNumber: true },
  });
  if (!existing) {
    return { ok: false, error: "El siniestro no existe o no tienes acceso." };
  }

  await db.claim.update({
    where: { id },
    data: {
      entryParty: data.entryParty === "" ? null : data.entryParty,
      entryChannel: data.entryChannel === "" ? null : data.entryChannel,
      reportedAtBroker: parseDate(data.reportedAtBroker),

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
      incidentNarrative: emptyToNull(data.incidentNarrative),

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
      description: data.description,

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

  const existing = await db.claim.findFirst({
    where: { id },
    select: {
      id: true,
      claimNumber: true,
      companyClaimNumber: true,
      liquidatorName: true,
      filedAtCompanyAt: true,
      status: true,
    },
  });
  if (!existing) {
    return { ok: false, error: "El siniestro no existe o no tienes acceso." };
  }

  const newCompanyClaim = emptyToNull(data.companyClaimNumber);
  const newLiquidator = emptyToNull(data.liquidatorName);
  const newFiledAt = parseDate(data.filedAtCompanyAt);

  await db.claim.update({
    where: { id },
    data: {
      companyClaimNumber: newCompanyClaim,
      liquidatorName: newLiquidator,
      filedAtCompanyAt: newFiledAt,
    },
  });

  if (newFiledAt && !existing.filedAtCompanyAt) {
    await logClaimEvent({
      db,
      organizationId: ctx.organizationId,
      claimId: id,
      kind: "COMPANY_FILED",
      message: "Denuncio ingresado en la compañía",
      userId: ctx.userId,
    });
    if (existing.status === "REPORTADO") {
      await db.$transaction([
        db.claim.update({
          where: { id },
          data: {
            status: "INGRESADO_COMPANIA",
            currentStateStartedAt: new Date(),
          },
        }),
        db.claimStatusHistory.create({
          data: {
            organizationId: ctx.organizationId,
            claimId: id,
            status: "INGRESADO_COMPANIA",
            note: "Ingresado automáticamente al registrar fecha de ingreso en compañía",
            changedById: ctx.userId,
          },
        }),
      ]);
    }
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

  const claim = await db.claim.findFirst({
    where: { id },
    select: { id: true, status: true, claimNumber: true },
  });
  if (!claim) {
    return { ok: false, error: "El siniestro no existe o no tienes acceso." };
  }
  if (claim.status === data.status) {
    return { ok: false, error: "El siniestro ya está en ese estado." };
  }

  await db.$transaction(async (tx) => {
    await tx.claim.update({
      where: { id },
      data: { status: data.status, currentStateStartedAt: new Date() },
    });
    await tx.claimStatusHistory.create({
      data: {
        organizationId: ctx.organizationId,
        claimId: id,
        status: data.status,
        note: emptyToNull(data.note),
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
      damagedGoodsDescription: emptyToNull(data.damagedGoodsDescription),
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
      message: parsed.data.message,
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

