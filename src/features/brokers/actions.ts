"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { brokerFormSchema, type BrokerFormValues } from "./schemas";

export type BrokerActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function createBrokerAction(
  values: BrokerFormValues,
): Promise<BrokerActionResult> {
  const parsed = brokerFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();

  try {
    const broker = await db.broker.create({
      data: {
        organizationId: ctx.organizationId,
        name: data.name,
        rut: emptyToNull(data.rut),
        email: emptyToNull(data.email),
        phone: emptyToNull(data.phone),
        contactName: emptyToNull(data.contactName),
        address: emptyToNull(data.address),
        isActive: data.isActive,
      },
    });
    revalidatePath("/configuracion/corredoras");
    return { ok: true, id: broker.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Ya existe una corredora con ese RUT.",
        fieldErrors: { rut: "RUT duplicado" },
      };
    }
    throw error;
  }
}

export async function updateBrokerAction(
  id: string,
  values: BrokerFormValues,
): Promise<BrokerActionResult> {
  const parsed = brokerFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
  }
  const data = parsed.data;
  const { db } = await requireOrgDb();

  const existing = await db.broker.findFirst({ where: { id } });
  if (!existing) {
    return { ok: false, error: "La corredora no existe o no tienes acceso." };
  }

  try {
    await db.broker.update({
      where: { id },
      data: {
        name: data.name,
        rut: emptyToNull(data.rut),
        email: emptyToNull(data.email),
        phone: emptyToNull(data.phone),
        contactName: emptyToNull(data.contactName),
        address: emptyToNull(data.address),
        isActive: data.isActive,
      },
    });
    revalidatePath("/configuracion/corredoras");
    return { ok: true, id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Ya existe una corredora con ese RUT.",
        fieldErrors: { rut: "RUT duplicado" },
      };
    }
    throw error;
  }
}

export async function deleteBrokerAction(
  id: string,
): Promise<BrokerActionResult> {
  const { db } = await requireOrgDb();
  const existing = await db.broker.findFirst({ where: { id } });
  if (!existing) {
    return { ok: false, error: "La corredora no existe o no tienes acceso." };
  }
  await db.broker.delete({ where: { id } });
  revalidatePath("/configuracion/corredoras");
  return { ok: true, id };
}
