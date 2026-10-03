"use server";

import type { PolicyStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgDb, requireOrgDbFor } from "@/server/context";
import { hasPermission } from "@/lib/factory-roles";
import { sensitiveReasonError } from "@/lib/domain/sensitive-reason";
import { cleanRut, isValidRut } from "@/lib/rut";
import { cleanPhone, suggestNaturalPerson } from "@/lib/domain/brokeris-clean";
import { evaluateBrokerisCuadre, parseUfDiffs, type CuadreInput } from "@/lib/domain/brokeris-cuadre";
import {
  isBrokerisPasteProfile,
  translateBrokerisPaste,
} from "@/lib/domain/brokeris-translate";
import { logActivity } from "@/server/activity";
import { applyBrokerisJob } from "@/features/imports/apply-brokeris";
import { restoreEndorsementSideEffects } from "@/features/endorsements/apply";
import {
  commandFingerprint,
  readIdempotency,
  storeIdempotency,
} from "@/server/idempotency";

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

type ParsedClient = {
  rowNo: number;
  rut: string;
  name: string;
  phone: string | null;
  suggestPerson: boolean;
  declaredType: "PERSONA" | "EMPRESA";
};

function parseClients(raw: string): ParsedClient[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line, index) => {
      const [rut, name, phone, declared] = line.split(";").map((part) => part.trim());
      const cleaned = cleanPhone(phone ?? "");
      const declaredType = declared?.toUpperCase() === "EMPRESA" ? "EMPRESA" : "PERSONA";
      return {
        rowNo: index + 1,
        rut: cleanRut(rut ?? ""),
        name: name ?? "",
        phone: cleaned.e164,
        suggestPerson: suggestNaturalPerson(rut ?? "", declaredType),
        declaredType,
      };
    });
}

export async function previewImportAction(form: FormData): Promise<void> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "imports.run")) {
    redirect("/importaciones?aviso=permiso");
  }
  const raw = text(form, "rows");
  const parsed = parseClients(raw);
  if (parsed.length === 0) redirect("/importaciones?aviso=vacio");
  const job = await db.importJob.create({
    data: {
      organizationId: ctx.organizationId,
      profile: "CLIENTES",
      status: "PREVIEW",
      fileName: text(form, "fileName") || "pegar.csv",
      createdById: ctx.userId,
    },
    select: { id: true },
  });
  await db.importJobRow.createMany({
    data: parsed.map((row) => ({
      organizationId: ctx.organizationId,
      jobId: job.id,
      rowNo: row.rowNo,
      action: isValidRut(row.rut) && row.name.length >= 2 ? "CREAR" : "REVISAR",
      payload: row,
      message:
        isValidRut(row.rut) && row.name.length >= 2
          ? null
          : "RUT o nombre no alcanza para crear la ficha.",
    })),
  });
  revalidatePath("/importaciones");
  redirect(`/importaciones?job=${job.id}`);
}

export async function applyImportAction(form: FormData): Promise<void> {
  const jobId = text(form, "jobId");
  const { ctx, db } = await requireOrgDbFor("imports.run");
  if (!db) redirect("/importaciones?aviso=permiso");
  const fingerprint = commandFingerprint(jobId);
  const prior = await readIdempotency(
    db,
    ctx.organizationId,
    `import:${jobId}`,
    fingerprint,
  );
  if (prior.kind === "replay") {
    redirect(`/importaciones?job=${jobId}&aviso=ya`);
  }
  const job = await db.importJob.findFirst({
    where: { id: jobId, status: "PREVIEW" },
    include: { rows: { orderBy: { rowNo: "asc" } } },
  });
  if (!job) redirect("/importaciones?aviso=lote");
  if (job.profile.startsWith("BROKERIS_")) {
    const created = await db.$transaction(async (tx) =>
      applyBrokerisJob(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        profile: job.profile,
        rows: job.rows,
      }),
    );
    await db.importJob.update({
      where: { id: jobId },
      data: { status: "APLICADO", appliedAt: new Date() },
    });
    await storeIdempotency(db, {
      organizationId: ctx.organizationId,
      key: `import:${jobId}`,
      fingerprint,
      command: "imports.apply",
      resultJson: { profile: job.profile, created },
    });
    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "CLIENT",
      entityId: ctx.organizationId,
      action: "import_applied",
      summary: `Lote ${job.profile} aplicado. Fichas nuevas: ${created}. Las filas en revisión quedaron sin crear.`,
      userId: ctx.userId,
    });
    revalidatePath("/importaciones");
    revalidatePath("/polizas");
    revalidatePath("/siniestros");
    redirect(`/importaciones?job=${jobId}&aviso=aplicado`);
  }
  if (job.profile !== "CLIENTES") {
    await db.importJob.update({
      where: { id: jobId },
      data: { status: "APLICADO", appliedAt: new Date() },
    });
    await storeIdempotency(db, {
      organizationId: ctx.organizationId,
      key: `import:${jobId}`,
      fingerprint,
      command: "imports.apply",
      resultJson: { profile: job.profile },
    });
    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "CLIENT",
      entityId: ctx.organizationId,
      action: "import_applied",
      summary: `Lote ${job.profile} registrado. El cuadre no crea fichas.`,
      userId: ctx.userId,
    });
    revalidatePath("/importaciones");
    redirect(`/importaciones?job=${jobId}&aviso=registrado`);
  }
  let created = 0;
  for (const row of job.rows) {
    const payload = row.payload as ParsedClient;
    if (row.action !== "CREAR") continue;
    const existing = await db.client.findFirst({
      where: { rut: payload.rut },
      select: { id: true },
    });
    if (existing) {
      await db.importJobRow.update({
        where: { id: row.id },
        data: { action: "OMITIR", message: "El RUT ya existe." },
      });
      continue;
    }
    const client = await db.client.create({
      data: {
        organizationId: ctx.organizationId,
        type: payload.suggestPerson ? "PERSONA" : payload.declaredType,
        rut: payload.rut,
        name: payload.name,
        phone: payload.phone,
        status: "PROSPECTO",
        source: "IMPORTACION",
        createdById: ctx.userId,
      },
      select: { id: true },
    });
    await db.importJobRow.update({
      where: { id: row.id },
      data: { createdEntityType: "CLIENT", createdEntityId: client.id, action: "CREADO" },
    });
    created += 1;
  }
  await db.importJob.update({
    where: { id: jobId },
    data: { status: "APLICADO", appliedAt: new Date() },
  });
  await storeIdempotency(db, {
    organizationId: ctx.organizationId,
    key: `import:${jobId}`,
    fingerprint,
    command: "imports.apply",
    resultJson: { created },
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLIENT",
    entityId: ctx.organizationId,
    action: "import_applied",
    summary: `Importación de clientes aplicada. Fichas nuevas: ${created}.`,
    userId: ctx.userId,
  });
  revalidatePath("/importaciones");
  revalidatePath("/clientes");
  redirect(`/importaciones?job=${jobId}&aviso=aplicado`);
}

export async function revertImportAction(form: FormData): Promise<void> {
  const jobId = text(form, "jobId");
  const reason = text(form, "reason");
  const reasonError = sensitiveReasonError(reason);
  if (reasonError) {
    redirect(`/importaciones?job=${jobId}&aviso=${encodeURIComponent(reasonError)}`);
  }
  const { ctx, db } = await requireOrgDbFor("imports.revert");
  if (!db) redirect(`/importaciones?job=${jobId}&aviso=permiso`);
  const job = await db.importJob.findFirst({
    where: { id: jobId, status: "APLICADO" },
    include: { rows: true },
  });
  if (!job) redirect("/importaciones?aviso=lote");
  if (job.profile.startsWith("BROKERIS_")) {
    const restoredMothers = new Set<string>();
    for (const row of job.rows) {
      const links = (row.payload ?? {}) as {
        _mother?: { id: string; status: string; nextPolicyId: string | null };
        _child?: {
          id: string;
          previousPolicyId: string | null;
          lineageId: string | null;
          termNumber: number | null;
        };
      };
      const mother = links._mother;
      if (mother && !restoredMothers.has(mother.id)) {
        restoredMothers.add(mother.id);
        const current = await db.policy.findFirst({
          where: { id: mother.id },
          select: { status: true },
        });
        if (current) {
          await db.policy.update({
            where: { id: mother.id },
            data: {
              status: mother.status as PolicyStatus,
              nextPolicyId: mother.nextPolicyId,
            },
          });
          if (current.status !== mother.status) {
            await db.policyStatusHistory.create({
              data: {
                organizationId: ctx.organizationId,
                policyId: mother.id,
                status: mother.status as PolicyStatus,
                note: `Lote de importación revertido: ${reason}`,
                changedById: ctx.userId,
              },
            });
          }
        }
      }
      const child = links._child;
      if (child && child.id !== row.createdEntityId) {
        await db.policy.updateMany({
          where: { id: child.id },
          data: {
            previousPolicyId: child.previousPolicyId,
            lineageId: child.lineageId,
            termNumber: child.termNumber ?? 1,
          },
        });
      }
      if (!row.createdEntityId) continue;
      if (row.createdEntityType === "CLAIM") {
        await db.claim.delete({ where: { id: row.createdEntityId } }).catch(() => null);
      } else if (row.createdEntityType === "NON_RENEWAL") {
        const prior = ((row.payload ?? {}) as { _prior?: Record<string, unknown> })._prior ?? {};
        await db.policy.update({
          where: { id: row.createdEntityId },
          data: {
            notRenewable: prior.notRenewable === true,
            nonRenewalReason:
              typeof prior.nonRenewalReason === "string" ? prior.nonRenewalReason : null,
            nonRenewalAt:
              typeof prior.nonRenewalAt === "string" ? new Date(prior.nonRenewalAt) : null,
            nonRenewalNote:
              typeof prior.nonRenewalNote === "string" ? prior.nonRenewalNote : null,
          },
        }).catch(() => null);
      } else if (row.createdEntityType === "ENDORSEMENT") {
        const endorsement = await db.endorsement.findFirst({
          where: { id: row.createdEntityId },
          select: {
            id: true,
            policyId: true,
            type: true,
            createdAt: true,
            priorSnapshot: true,
          },
        });
        if (endorsement) {
          await restoreEndorsementSideEffects(db, endorsement, {
            organizationId: ctx.organizationId,
            userId: ctx.userId,
          });
          await db.endorsement.delete({ where: { id: endorsement.id } }).catch(() => null);
        }
      } else if (row.createdEntityType === "POLICY") {
        const [endorsements, claims] = await Promise.all([
          db.endorsement.count({ where: { policyId: row.createdEntityId } }),
          db.claim.count({ where: { policyId: row.createdEntityId } }),
        ]);
        if (endorsements > 0 || claims > 0) {
          await db.importJobRow.update({
            where: { id: row.id },
            data: { message: "No se borró: la póliza ya tiene endosos o siniestros." },
          });
          continue;
        }
        await db.policy.delete({ where: { id: row.createdEntityId } }).catch(() => null);
        const extra = (row.payload ?? {}) as {
          _createdCompanyId?: string;
        };
        if (extra._createdCompanyId) {
          const companyId = extra._createdCompanyId;
          const uses = await Promise.all([
            db.policy.count({ where: { companyId } }),
            db.proposal.count({ where: { companyId } }),
            db.insuranceProduct.count({ where: { insuranceCompanyId: companyId } }),
            db.insuranceCompanyContact.count({ where: { insuranceCompanyId: companyId } }),
            db.proposalCoaseguroParticipation.count({
              where: { insuranceCompanyId: companyId },
            }),
          ]);
          if (uses.every((count) => count === 0)) {
            await db.insuranceCompany
              .delete({ where: { id: extra._createdCompanyId } })
              .catch(() => null);
          }
        }
      }
      await db.importJobRow.update({
        where: { id: row.id },
        data: { action: "REVERTIDO", message: reason },
      });
    }
    await db.importJob.update({
      where: { id: jobId },
      data: { status: "REVERTIDO", revertedAt: new Date(), decisionNote: reason },
    });
    revalidatePath("/importaciones");
    revalidatePath("/polizas");
    redirect(`/importaciones?job=${jobId}&aviso=revertido`);
  }
  if (job.profile !== "CLIENTES") {
    await db.importJob.update({
      where: { id: jobId },
      data: { status: "REVERTIDO", revertedAt: new Date(), decisionNote: reason },
    });
    revalidatePath("/importaciones");
    redirect(`/importaciones?job=${jobId}&aviso=revertido`);
  }
  for (const row of job.rows) {
    if (row.createdEntityType !== "CLIENT" || !row.createdEntityId) continue;
    const [proposals, policies] = await Promise.all([
      db.proposal.count({ where: { clientId: row.createdEntityId } }),
      db.policy.count({ where: { clientId: row.createdEntityId } }),
    ]);
    if (proposals > 0 || policies > 0) {
      await db.importJobRow.update({
        where: { id: row.id },
        data: { message: "No se borró: la ficha ya tiene cartera." },
      });
      continue;
    }
    await db.client.delete({ where: { id: row.createdEntityId } });
    await db.importJobRow.update({
      where: { id: row.id },
      data: { action: "REVERTIDO", message: reason },
    });
  }
  await db.importJob.update({
    where: { id: jobId },
    data: { status: "REVERTIDO", revertedAt: new Date(), decisionNote: reason },
  });
  revalidatePath("/importaciones");
  revalidatePath("/clientes");
  redirect(`/importaciones?job=${jobId}&aviso=revertido`);
}

function amount(form: FormData, key: string): number {
  const raw = text(form, key).replace(/\s/g, "").replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function checked(form: FormData, key: string): boolean {
  const value = form.get(key);
  return value === "on" || value === "1" || value === "true";
}

function diffs(form: FormData, key: string): number[] {
  return parseUfDiffs(text(form, key));
}

export async function previewBrokerisAction(form: FormData): Promise<void> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "imports.run")) {
    redirect("/importaciones?aviso=permiso");
  }
  const profile = text(form, "profile");
  if (!isBrokerisPasteProfile(profile)) redirect("/importaciones?aviso=perfil");
  const parsed = translateBrokerisPaste(profile, text(form, "rows"));
  if (parsed.length === 0) redirect("/importaciones?aviso=vacio");
  const job = await db.importJob.create({
    data: {
      organizationId: ctx.organizationId,
      profile: `BROKERIS_${profile}`,
      status: "PREVIEW",
      fileName: text(form, "fileName") || "brokeris.txt",
      createdById: ctx.userId,
      decisionNote: "Traducción de códigos. Al aplicar se crean las filas traducidas que traen contratante, número y fechas.",
    },
    select: { id: true },
  });
  await db.importJobRow.createMany({
    data: parsed.map((row) => ({
      organizationId: ctx.organizationId,
      jobId: job.id,
      rowNo: row.rowNo,
      action: row.action,
      payload: row.payload,
      message: row.message,
    })),
  });
  revalidatePath("/importaciones");
  redirect(`/importaciones?job=${job.id}`);
}

export async function previewCuadreAction(form: FormData): Promise<void> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "imports.run")) {
    redirect("/importaciones?aviso=permiso");
  }
  const year = amount(form, "commissionYear");
  const input: CuadreInput = {
    policiesInForce: amount(form, "policiesInForce"),
    endorsementsInForce: amount(form, "endorsementsInForce"),
    endorsementDifferenceExplained: checked(form, "endorsementDifferenceExplained"),
    policyPremiumDiffsUf: diffs(form, "policyPremiumDiffsUf"),
    commissionDiffsUf: diffs(form, "commissionDiffsUf"),
    commissionLargerDiffsExplained: checked(form, "commissionLargerDiffsExplained"),
    contractors: amount(form, "contractors"),
    insureds: amount(form, "insureds"),
    companiesBeforeMerge: amount(form, "companiesBeforeMerge"),
    personsBeforeMerge: amount(form, "personsBeforeMerge"),
    companiesAfterMerge: amount(form, "companiesAfterMerge"),
    personsAfterMerge: amount(form, "personsAfterMerge"),
    clientsAfterExplained: checked(form, "clientsAfterExplained"),
    renewalsCutMonth: amount(form, "renewalsCutMonth"),
    renewalsNextMonth: amount(form, "renewalsNextMonth"),
    openClaims: amount(form, "openClaims"),
    claimsToExtend: amount(form, "claimsToExtend"),
    claimsToExtendExplained: checked(form, "claimsToExtendExplained"),
    pendingInstallmentCount: amount(form, "pendingInstallmentCount"),
    pendingInstallmentAmount: amount(form, "pendingInstallmentAmount"),
    approvedInstallmentCount: amount(form, "approvedInstallmentCount"),
    approvedInstallmentAmount: amount(form, "approvedInstallmentAmount"),
    installmentDecisionRecorded: checked(form, "installmentDecisionRecorded"),
    commissionPaymentsByYear:
      year > 0
        ? [
            {
              year,
              brokerisClp: amount(form, "brokerisCommissionClp"),
              polizzaClp: amount(form, "polizzaCommissionClp"),
              times100Explained: checked(form, "times100Explained"),
            },
          ]
        : [],
    grossPremium2025Clp: amount(form, "grossPremium2025Clp"),
    commissions2025Clp: amount(form, "commissions2025Clp"),
    productionExplained: checked(form, "productionExplained"),
    documentsTotal: amount(form, "documentsTotal"),
    documentsLinked: amount(form, "documentsLinked"),
    documentsCounted: checked(form, "documentsCounted"),
    maxProposal: amount(form, "maxProposal"),
    maxClaimFolder: amount(form, "maxClaimFolder"),
    maxPlan: amount(form, "maxPlan"),
    counterProposal: amount(form, "counterProposal"),
    counterClaimFolder: amount(form, "counterClaimFolder"),
    counterPlan: amount(form, "counterPlan"),
  };
  const report = evaluateBrokerisCuadre(input);
  const job = await db.importJob.create({
    data: {
      organizationId: ctx.organizationId,
      profile: "CUADRE",
      status: "PREVIEW",
      fileName: "cuadre",
      createdById: ctx.userId,
      decisionNote: report.gateA
        ? "Gate A listo. Q2 no entra en esa puerta."
        : "Gate A con cuadres fuera de tolerancia.",
    },
    select: { id: true },
  });
  await db.importJobRow.createMany({
    data: report.rows.map((row, index) => ({
      organizationId: ctx.organizationId,
      jobId: job.id,
      rowNo: index + 1,
      action: row.status,
      payload: row,
      message: `${row.code} ${row.label}: ${row.actual} · ${row.status}. Tolerancia: ${row.tolerance}.`,
    })),
  });
  revalidatePath("/importaciones");
  redirect(`/importaciones?job=${job.id}`);
}
