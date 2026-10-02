"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import { hasPermission } from "@/lib/factory-roles";
import { sensitiveReasonError } from "@/lib/domain/sensitive-reason";
import { cleanRut, isValidRut } from "@/lib/rut";
import { cleanPhone, suggestNaturalPerson } from "@/lib/domain/brokeris-clean";
import { logActivity } from "@/server/activity";
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
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "imports.run")) {
    redirect("/importaciones?aviso=permiso");
  }
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
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "imports.revert")) {
    redirect(`/importaciones?job=${jobId}&aviso=permiso`);
  }
  const job = await db.importJob.findFirst({
    where: { id: jobId, status: "APLICADO" },
    include: { rows: true },
  });
  if (!job) redirect("/importaciones?aviso=lote");
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
