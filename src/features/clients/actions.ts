"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { logActivity } from "@/server/activity";
import { canDeleteClient } from "@/lib/roles";
import { normalizeRut } from "@/lib/rut";
import {
  clientFormSchema,
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

/**
 * Crea un cliente "prospecto" mínimo (rut + nombre + tipo) desde formularios
 * inline como el de propuesta. Devuelve id + nombre para que el caller
 * pueda seleccionarlo de inmediato en el dropdown.
 */
export async function createProspectClientAction(input: {
  rut: string;
  name: string;
  type?: "PERSONA" | "EMPRESA";
}): Promise<
  | { ok: true; id: string; name: string }
  | { ok: false; error: string }
> {
  const rut = input.rut?.trim();
  const name = input.name?.trim();
  if (!rut || !name) {
    return { ok: false, error: "RUT y nombre son requeridos." };
  }
  const { ctx, db } = await requireOrgDb();
  try {
    const created = await db.client.create({
      data: {
        organizationId: ctx.organizationId,
        type: input.type ?? "PERSONA",
        rut: normalizeRut(rut),
        name,
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

  try {
    const client = await db.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          organizationId: ctx.organizationId,
          type: data.type,
          rut: normalizeRut(data.rut),
          name: data.name,
          legalName: emptyToNull(data.legalName),
          giro: emptyToNull(data.giro),
          birthDate: parseDate(data.birthDate),
          email: emptyToNull(data.email),
          phone: emptyToNull(data.phone),
          celular: emptyToNull(data.celular),
          address: emptyToNull(data.address),
          region: emptyToNull(data.region),
          commune: emptyToNull(data.commune),
          source: emptyToNull(data.source),
          status: data.status,
          assignedUserId: emptyToNull(data.assignedUserId) ?? ctx.userId,
          vendedor: emptyToNull(data.vendedor),
          cobranzaUserId: emptyToNull(data.cobranzaUserId),
          siniestrosUserId: emptyToNull(data.siniestrosUserId),
          holdingId: emptyToNull(data.holdingId),
          comentarioAlerta: emptyToNull(data.comentarioAlerta),
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
            email: emptyToNull(contact.email),
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

  try {
    await db.$transaction(async (tx) => {
      await tx.client.update({
        where: { id },
        data: {
          type: data.type,
          rut: normalizeRut(data.rut),
          name: data.name,
          legalName: emptyToNull(data.legalName),
          giro: emptyToNull(data.giro),
          birthDate: parseDate(data.birthDate),
          email: emptyToNull(data.email),
          phone: emptyToNull(data.phone),
          celular: emptyToNull(data.celular),
          address: emptyToNull(data.address),
          region: emptyToNull(data.region),
          commune: emptyToNull(data.commune),
          source: emptyToNull(data.source),
          status: data.status,
          assignedUserId: emptyToNull(data.assignedUserId) ?? ctx.userId,
          vendedor: emptyToNull(data.vendedor),
          cobranzaUserId: emptyToNull(data.cobranzaUserId),
          siniestrosUserId: emptyToNull(data.siniestrosUserId),
          holdingId: emptyToNull(data.holdingId),
          comentarioAlerta: emptyToNull(data.comentarioAlerta),
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
            email: emptyToNull(contact.email),
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
      summary: `Cliente actualizado: ${data.name}`,
      userId: ctx.userId,
    });

    revalidatePath("/clientes");
    revalidatePath(`/clientes/${id}`);
    return { ok: true, id };
  } catch (error) {
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

/** Verifica si un correo ya está usado por otro cliente de la corredora. */
export async function checkClientEmailAction(
  email: string,
  excludeId?: string,
): Promise<{ exists: boolean; clientName: string | null }> {
  const trimmed = email.trim();
  if (!trimmed) return { exists: false, clientName: null };
  const { db } = await requireOrgDb();
  const match = await db.client.findFirst({
    where: {
      email: { equals: trimmed, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { name: true },
  });
  return { exists: Boolean(match), clientName: match?.name ?? null };
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
