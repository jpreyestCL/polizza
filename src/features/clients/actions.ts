"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { logActivity } from "@/server/activity";
import { canDeleteClient } from "@/lib/roles";
import { hasPermission } from "@/lib/factory-roles";
import { sensitiveReasonError } from "@/lib/domain/sensitive-reason";
import { cleanRut, normalizeRut } from "@/lib/rut";
import type { Db } from "@/server/db";
import { normalizeClientEmail } from "./privacy";
import {
  clientFormSchema,
  composeClientName,
  INTERACTION_CHANNELS,
  INTERACTION_LABELS,
  type ClientFormValues,
} from "./schemas";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function emptyToNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function duplicateRutResult(): ActionResult {
  return {
    ok: false,
    error: "Ya existe un cliente con ese RUT en tu corredora.",
    fieldErrors: { rut: "RUT ya registrado" },
  };
}

async function duplicateEmailResult(
  db: Pick<Db, "client">,
  data: ClientFormValues,
  currentClientId?: string,
): Promise<Extract<ActionResult, { ok: false }> | null> {
  const fields = [
    { path: "email", email: normalizeClientEmail(data.email) },
    ...data.contacts.map((contact, index) => ({
      path: `contacts.${index}.email`,
      email: normalizeClientEmail(contact.email),
    })),
  ].filter((item): item is { path: string; email: string } => Boolean(item.email));

  const fieldErrors: Record<string, string> = {};
  const occurrences = new Map<string, string[]>();
  for (const field of fields) {
    occurrences.set(field.email, [...(occurrences.get(field.email) ?? []), field.path]);
  }
  for (const paths of occurrences.values()) {
    if (paths.length > 1) {
      for (const path of paths) fieldErrors[path] = "Correo repetido en este cliente";
    }
  }

  const emails = [...occurrences.keys()];
  if (emails.length > 0) {
    const existing = await db.client.findMany({
      where: {
        ...(currentClientId ? { id: { not: currentClientId } } : {}),
        OR: [
          ...emails.map((email) => ({
            email: { equals: email, mode: "insensitive" as const },
          })),
          {
            contacts: {
              some: {
                OR: emails.map((email) => ({
                  email: { equals: email, mode: "insensitive" as const },
                })),
              },
            },
          },
        ],
      },
      select: {
        email: true,
        contacts: { select: { email: true } },
      },
    });
    const used = new Set(
      existing.flatMap((client) => [
        normalizeClientEmail(client.email),
        ...client.contacts.map((contact) => normalizeClientEmail(contact.email)),
      ]).filter((email): email is string => Boolean(email)),
    );
    for (const field of fields) {
      if (used.has(field.email)) {
        fieldErrors[field.path] = "Correo ya registrado en otro cliente";
      }
    }
  }

  return Object.keys(fieldErrors).length
    ? {
        ok: false,
        error: "Hay correos duplicados en la corredora.",
        fieldErrors,
      }
    : null;
}

class DuplicateClientEmailError extends Error {
  constructor(readonly result: Extract<ActionResult, { ok: false }>) {
    super(result.error);
  }
}

/**
 * Crea un cliente "prospecto" mínimo (rut + nombre + tipo) desde formularios
 * inline como el de propuesta. Devuelve id + nombre para que el caller
 * pueda seleccionarlo de inmediato en el dropdown.
 */
export async function createProspectClientAction(input: {
  rut: string;
  name?: string;
  firstName?: string;
  lastNamePaterno?: string;
  lastNameMaterno?: string;
  type?: "PERSONA" | "EMPRESA";
}): Promise<
  | { ok: true; id: string; name: string }
  | { ok: false; error: string }
> {
  const rut = input.rut?.trim();
  const type = input.type ?? "PERSONA";
  const firstName = input.firstName?.trim() ?? "";
  const lastNamePaterno = input.lastNamePaterno?.trim() ?? "";
  const lastNameMaterno = input.lastNameMaterno?.trim() ?? "";
  const name = composeClientName({
    type,
    name: input.name,
    firstName,
    lastNamePaterno,
    lastNameMaterno,
  });
  if (!rut) {
    return { ok: false, error: "RUT requerido." };
  }
  if (type === "PERSONA" && (!firstName || !lastNamePaterno)) {
    return {
      ok: false,
      error: "Nombres y apellido paterno son requeridos.",
    };
  }
  if (!name) {
    return { ok: false, error: "Nombre requerido." };
  }
  const { ctx, db } = await requireOrgDb();
  try {
    const created = await db.client.create({
      data: {
        organizationId: ctx.organizationId,
        type,
        rut: normalizeRut(rut),
        name,
        firstName: type === "PERSONA" ? firstName : null,
        lastNamePaterno: type === "PERSONA" ? lastNamePaterno : null,
        lastNameMaterno:
          type === "PERSONA" ? (lastNameMaterno || null) : null,
        status: "PROSPECTO",
        assignedUserId: ctx.userId,
        createdById: ctx.userId,
        updatedById: ctx.userId,
      },
      select: { id: true, name: true },
    });
    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "CLIENT",
      entityId: created.id,
      action: "created_inline",
      summary: `Cliente prospecto ${created.name} creado desde propuesta`,
      userId: ctx.userId,
    });
    revalidatePath("/clientes");
    return { ok: true, id: created.id, name: created.name };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      // Ya existe un cliente con ese RUT en la org — devolverlo
      const existing = await db.client.findFirst({
        where: { rut: normalizeRut(rut) },
        select: { id: true, name: true },
      });
      if (existing) {
        return { ok: true, id: existing.id, name: existing.name };
      }
      return { ok: false, error: "Ya existe un cliente con ese RUT." };
    }
    throw e;
  }
}

export async function createClientAction(
  values: ClientFormValues,
): Promise<ActionResult> {
  const parsed = clientFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();
  const emailConflict = await duplicateEmailResult(db, data);
  if (emailConflict) return emailConflict;

  try {
    const client = await db.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${"client-email:" + ctx.organizationId}))`,
      );
      const conflict = await duplicateEmailResult(tx, data);
      if (conflict) throw new DuplicateClientEmailError(conflict);
      const created = await tx.client.create({
        data: {
          organizationId: ctx.organizationId,
          type: data.type,
          rut: normalizeRut(data.rut),
          name: composeClientName(data) || data.name,
          firstName:
            data.type === "PERSONA" ? emptyToNull(data.firstName) : null,
          lastNamePaterno:
            data.type === "PERSONA"
              ? emptyToNull(data.lastNamePaterno)
              : null,
          lastNameMaterno:
            data.type === "PERSONA"
              ? emptyToNull(data.lastNameMaterno)
              : null,
          legalName: emptyToNull(data.legalName),
          giro: emptyToNull(data.giro),
          birthDate: parseDate(data.birthDate),
          email: normalizeClientEmail(data.email),
          phone: emptyToNull(data.phone),
          celular: emptyToNull(data.celular),
          address: emptyToNull(data.address),
          region: emptyToNull(data.region),
          commune: emptyToNull(data.commune),
          city: emptyToNull(data.city),
          source: emptyToNull(data.source),
          status: data.status,
          assignedUserId: emptyToNull(data.assignedUserId) ?? ctx.userId,
          vendedor: emptyToNull(data.vendedor),
          cobranzaUserId: emptyToNull(data.cobranzaUserId),
          siniestrosUserId: emptyToNull(data.siniestrosUserId),
          holdingId: emptyToNull(data.holdingId),
          comentarioAlerta: emptyToNull(data.comentarioAlerta),
          marketingConsent: data.marketingConsent,
          marketingConsentAt: data.marketingConsent ? new Date() : null,
          aiProcessingConsent: data.aiProcessingConsent,
          aiProcessingConsentAt: data.aiProcessingConsent ? new Date() : null,
          observaciones: emptyToNull(data.observaciones),
          createdById: ctx.userId,
          updatedById: ctx.userId,
        },
      });
      if (data.contacts.length > 0) {
        await tx.clientContact.createMany({
          data: data.contacts.map((contact) => ({
            organizationId: ctx.organizationId,
            clientId: created.id,
            name: contact.name,
            role: emptyToNull(contact.role),
            email: normalizeClientEmail(contact.email),
            phone: emptyToNull(contact.phone),
            celular: emptyToNull(contact.celular),
            assignmentType: contact.assignmentType || null,
            isPrimary: contact.isPrimary,
          })),
        });
      }
      return created;
    });

    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "CLIENT",
      entityId: client.id,
      action: "created",
      summary: `Cliente creado: ${client.name}`,
      userId: ctx.userId,
    });

    revalidatePath("/clientes");
    return { ok: true, id: client.id };
  } catch (error) {
    if (error instanceof DuplicateClientEmailError) return error.result;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return duplicateRutResult();
    }
    throw error;
  }
}

export async function updateClientAction(
  id: string,
  values: ClientFormValues,
): Promise<ActionResult> {
  const parsed = clientFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  const existing = await db.client.findFirst({ where: { id } });
  if (!existing) {
    return { ok: false, error: "El cliente no existe o no tienes acceso." };
  }
  const emailConflict = await duplicateEmailResult(db, data, id);
  if (emailConflict) return emailConflict;

  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${"client-email:" + ctx.organizationId}))`,
      );
      const conflict = await duplicateEmailResult(tx, data, id);
      if (conflict) throw new DuplicateClientEmailError(conflict);
      await tx.client.update({
        where: { id },
        data: {
          type: data.type,
          rut: normalizeRut(data.rut),
          name: composeClientName(data) || data.name,
          firstName:
            data.type === "PERSONA" ? emptyToNull(data.firstName) : null,
          lastNamePaterno:
            data.type === "PERSONA"
              ? emptyToNull(data.lastNamePaterno)
              : null,
          lastNameMaterno:
            data.type === "PERSONA"
              ? emptyToNull(data.lastNameMaterno)
              : null,
          legalName: emptyToNull(data.legalName),
          giro: emptyToNull(data.giro),
          birthDate: parseDate(data.birthDate),
          email: normalizeClientEmail(data.email),
          phone: emptyToNull(data.phone),
          celular: emptyToNull(data.celular),
          address: emptyToNull(data.address),
          region: emptyToNull(data.region),
          commune: emptyToNull(data.commune),
          city: emptyToNull(data.city),
          source: emptyToNull(data.source),
          status: data.status,
          assignedUserId: emptyToNull(data.assignedUserId) ?? ctx.userId,
          vendedor: emptyToNull(data.vendedor),
          cobranzaUserId: emptyToNull(data.cobranzaUserId),
          siniestrosUserId: emptyToNull(data.siniestrosUserId),
          holdingId: emptyToNull(data.holdingId),
          comentarioAlerta: emptyToNull(data.comentarioAlerta),
          marketingConsent: data.marketingConsent,
          marketingConsentAt: data.marketingConsent
            ? (existing.marketingConsentAt ?? new Date())
            : null,
          aiProcessingConsent: data.aiProcessingConsent,
          aiProcessingConsentAt: data.aiProcessingConsent
            ? (existing.aiProcessingConsentAt ?? new Date())
            : null,
          observaciones: emptyToNull(data.observaciones),
          updatedById: ctx.userId,
        },
      });
      await tx.clientContact.deleteMany({ where: { clientId: id } });
      if (data.contacts.length > 0) {
        await tx.clientContact.createMany({
          data: data.contacts.map((contact) => ({
            organizationId: ctx.organizationId,
            clientId: id,
            name: contact.name,
            role: emptyToNull(contact.role),
            email: normalizeClientEmail(contact.email),
            phone: emptyToNull(contact.phone),
            celular: emptyToNull(contact.celular),
            assignmentType: contact.assignmentType || null,
            isPrimary: contact.isPrimary,
          })),
        });
      }
    });

    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "CLIENT",
      entityId: id,
      action: "updated",
      summary: `Cliente actualizado: ${composeClientName(data) || data.name}`,
      userId: ctx.userId,
    });

    revalidatePath("/clientes");
    revalidatePath(`/clientes/${id}`);
    return { ok: true, id };
  } catch (error) {
    if (error instanceof DuplicateClientEmailError) return error.result;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return duplicateRutResult();
    }
    throw error;
  }
}

export async function deleteClientAction(id: string): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!canDeleteClient(ctx.role)) {
    return {
      ok: false,
      error: "No tienes permiso para eliminar clientes.",
    };
  }

  const existing = await db.client.findFirst({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) {
    return { ok: false, error: "El cliente no existe o no tienes acceso." };
  }

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLIENT",
    entityId: id,
    action: "deleted",
    summary: `Cliente eliminado: ${existing.name}`,
    userId: ctx.userId,
  });
  await db.client.delete({ where: { id } });

  revalidatePath("/clientes");
  return { ok: true, id };
}

export async function createClientTagAction(name: string): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "parties.write")) {
    return { ok: false, error: "No tienes permiso para administrar tags." };
  }
  const normalizedName = name.trim();
  if (!normalizedName || normalizedName.length > 60) {
    return { ok: false, error: "El tag debe tener entre 1 y 60 caracteres." };
  }
  const duplicate = await db.clientTag.findFirst({
    where: { name: { equals: normalizedName, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) return { ok: false, error: "Ese tag ya existe." };
  const tag = await db.clientTag.create({
    data: { organizationId: ctx.organizationId, name: normalizedName },
  });
  revalidatePath("/clientes");
  return { ok: true, id: tag.id };
}

export async function deleteClientTagAction(id: string): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "parties.write")) {
    return { ok: false, error: "No tienes permiso para administrar tags." };
  }
  const tag = await db.clientTag.findFirst({ where: { id }, select: { id: true } });
  if (!tag) return { ok: false, error: "El tag no existe." };
  await db.clientTag.delete({ where: { id } });
  revalidatePath("/clientes");
  return { ok: true, id };
}

export async function updateClientTagAction(
  id: string,
  name: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "parties.write")) {
    return { ok: false, error: "No tienes permiso para administrar tags." };
  }
  const normalizedName = name.trim();
  if (!normalizedName || normalizedName.length > 60) {
    return { ok: false, error: "El tag debe tener entre 1 y 60 caracteres." };
  }
  const [tag, duplicate] = await Promise.all([
    db.clientTag.findFirst({ where: { id }, select: { id: true } }),
    db.clientTag.findFirst({
      where: {
        id: { not: id },
        name: { equals: normalizedName, mode: "insensitive" },
      },
      select: { id: true },
    }),
  ]);
  if (!tag) return { ok: false, error: "El tag no existe." };
  if (duplicate) return { ok: false, error: "Ese tag ya existe." };
  await db.clientTag.update({ where: { id }, data: { name: normalizedName } });
  revalidatePath("/clientes");
  return { ok: true, id };
}

export async function setClientTagAction(
  clientId: string,
  tagId: string,
  assigned: boolean,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "parties.write")) {
    return { ok: false, error: "No tienes permiso para asignar tags." };
  }
  const [client, tag] = await Promise.all([
    db.client.findFirst({ where: { id: clientId }, select: { id: true } }),
    db.clientTag.findFirst({ where: { id: tagId }, select: { id: true } }),
  ]);
  if (!client || !tag) return { ok: false, error: "Cliente o tag no encontrado." };
  if (assigned) {
    await db.clientTagAssignment.upsert({
      where: { clientId_tagId: { clientId, tagId } },
      create: { organizationId: ctx.organizationId, clientId, tagId },
      update: {},
    });
  } else {
    await db.clientTagAssignment.deleteMany({ where: { clientId, tagId } });
  }
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, id: clientId };
}

/** Registra una gestión (correo, WhatsApp, llamada o nota) en la bitácora. */
export async function logClientInteractionAction(
  clientId: string,
  channel: string,
  note: string,
): Promise<ActionResult> {
  if (!(INTERACTION_CHANNELS as readonly string[]).includes(channel)) {
    return { ok: false, error: "Tipo de gestión inválido." };
  }
  const { ctx, db } = await requireOrgDb();
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { id: true },
  });
  if (!client) {
    return { ok: false, error: "El cliente no existe o no tienes acceso." };
  }
  const detail = note.trim();
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLIENT",
    entityId: clientId,
    action: `interaction_${channel.toLowerCase()}`,
    summary: `${INTERACTION_LABELS[channel]}${detail ? `: ${detail}` : ""}`,
    userId: ctx.userId,
  });
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, id: clientId };
}

/** Pasa la cartera del RUT duplicado al cliente abierto y borra el duplicado. */
export async function mergeClientFormAction(form: FormData): Promise<void> {
  const targetId = String(form.get("targetId") ?? "");
  const sourceRut = String(form.get("sourceRut") ?? "");
  const reason = String(form.get("reason") ?? "");
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "parties.merge")) {
    redirect(`/clientes/${targetId}?aviso=${encodeURIComponent("No tienes permiso para fusionar clientes.")}`);
  }
  const reasonError = sensitiveReasonError(reason);
  if (reasonError) {
    redirect(`/clientes/${targetId}?aviso=${encodeURIComponent(reasonError)}`);
  }
  const cleaned = cleanRut(sourceRut);
  const candidates = await db.client.findMany({
    select: { id: true, rut: true, name: true },
  });
  const source = candidates.find(
    (client) => client.rut && cleanRut(client.rut) === cleaned && client.id !== targetId,
  );
  if (!source) {
    redirect(`/clientes/${targetId}?aviso=${encodeURIComponent("No hay otro cliente con ese RUT.")}`);
  }
  const target = candidates.find((client) => client.id === targetId);
  if (!target) {
    redirect("/clientes");
  }
  await db.$transaction(async (tx) => {
    await tx.proposal.updateMany({
      where: { clientId: source.id },
      data: { clientId: targetId },
    });
    await tx.proposal.updateMany({
      where: { insuredClientId: source.id },
      data: { insuredClientId: targetId },
    });
    await tx.proposal.updateMany({
      where: { beneficiaryClientId: source.id },
      data: { beneficiaryClientId: targetId },
    });
    await tx.policy.updateMany({
      where: { clientId: source.id },
      data: { clientId: targetId },
    });
    await tx.claim.updateMany({
      where: { clientId: source.id },
      data: { clientId: targetId },
    });
    await tx.carQuotation.updateMany({
      where: { clientId: source.id },
      data: { clientId: targetId },
    });
    await tx.quoteRequest.updateMany({
      where: { clientId: source.id },
      data: { clientId: targetId },
    });
    await tx.branch.updateMany({
      where: { clientId: source.id },
      data: { clientId: targetId },
    });
    await tx.clientContact.updateMany({
      where: { clientId: source.id },
      data: { clientId: targetId },
    });
    const targetTags = await tx.clientTagAssignment.findMany({
      where: { clientId: targetId },
      select: { tagId: true },
    });
    const tagIds = new Set(targetTags.map((row) => row.tagId));
    if (tagIds.size > 0) {
      await tx.clientTagAssignment.deleteMany({
        where: { clientId: source.id, tagId: { in: [...tagIds] } },
      });
    }
    await tx.clientTagAssignment.updateMany({
      where: { clientId: source.id },
      data: { clientId: targetId },
    });
    await tx.client.delete({ where: { id: source.id } });
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "CLIENT",
    entityId: targetId,
    action: "merged",
    summary: `Se fusionó ${source.name} (${normalizeRut(source.rut ?? sourceRut)}) en este cliente. ${reason.trim()}`,
    userId: ctx.userId,
  });
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${targetId}`);
  redirect(`/clientes/${targetId}?aviso=${encodeURIComponent(`Se fusionó ${source.name}.`)}`);
}
