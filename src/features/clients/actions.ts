"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { logActivity } from "@/server/activity";
import { canDeleteClient } from "@/lib/roles";
import { normalizeRut } from "@/lib/rut";
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

  try {
    const client = await db.$transaction(async (tx) => {
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
          email: emptyToNull(data.email),
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
          email: emptyToNull(data.email),
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
      summary: `Cliente actualizado: ${composeClientName(data) || data.name}`,
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
