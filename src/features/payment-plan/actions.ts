"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import {
  paymentPlanSchema,
  proposalLogSchema,
  type PaymentPlanValues,
  type ProposalLogValues,
} from "./schemas";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function toDecimal(v: string | number): Prisma.Decimal | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return null;
  return new Prisma.Decimal(n);
}

function toDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toNullable(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

export async function upsertPaymentPlanAction(
  proposalId: string,
  raw: PaymentPlanValues,
): Promise<ActionResult> {
  const parsed = paymentPlanSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { ctx, db } = await requireOrgDb();
  const proposal = await db.proposal.findFirst({
    where: { id: proposalId },
    select: { id: true, proposalNumber: true, currency: true },
  });
  if (!proposal) return { ok: false, error: "Propuesta no existe." };

  const data = {
    organizationId: ctx.organizationId,
    proposalId,
    sinPlanDePago: parsed.data.sinPlanDePago,
    option: parsed.data.option ?? null,
    installmentsCount: Number(parsed.data.installmentsCount) || 0,
    observations: toNullable(parsed.data.observations),
    documented: parsed.data.documented,
    firstPaymentDate: toDate(parsed.data.firstPaymentDate),
    firstSignDate: toDate(parsed.data.firstSignDate),
    valorCuota: toDecimal(parsed.data.valorCuota),
    cobrAnticipada: parsed.data.cobrAnticipada,
    facturaAnticipada: parsed.data.facturaAnticipada,
    requiereFactura: parsed.data.requiereFactura,
    primaBruta: toDecimal(parsed.data.primaBruta),
    cambio: toDecimal(parsed.data.cambio),
    primaTotalPesos: toDecimal(parsed.data.primaTotalPesos),
    payerRut: toNullable(parsed.data.payerRut),
    payerName: toNullable(parsed.data.payerName),
    payerLastName: toNullable(parsed.data.payerLastName),
    payerLegalName: toNullable(parsed.data.payerLegalName),
    payerPhone: toNullable(parsed.data.payerPhone),
    payerCelular: toNullable(parsed.data.payerCelular),
    payerEmail: toNullable(parsed.data.payerEmail),
  };

  const existing = await db.paymentPlan.findUnique({ where: { proposalId } });
  let planId: string;
  if (existing) {
    const updated = await db.paymentPlan.update({
      where: { proposalId },
      data,
      select: { id: true },
    });
    planId = updated.id;
  } else {
    const created = await db.paymentPlan.create({
      data,
      select: { id: true },
    });
    planId = created.id;
  }

  // Generar cuotas si se solicitó
  if (parsed.data.generateInstallments) {
    const count = Number(parsed.data.installmentsCount);
    const valor = Number(parsed.data.valorCuota);
    const firstDate = toDate(parsed.data.firstPaymentDate);
    if (count > 0 && valor > 0 && firstDate) {
      // Eliminar cuotas anteriores de este plan
      await db.installment.deleteMany({
        where: { paymentPlanId: planId },
      });
      const rows: Prisma.InstallmentCreateManyInput[] = [];
      for (let i = 0; i < count; i++) {
        const d = new Date(firstDate);
        d.setMonth(d.getMonth() + i);
        rows.push({
          organizationId: ctx.organizationId,
          paymentPlanId: planId,
          policyId: null,
          number: i + 1,
          amount: new Prisma.Decimal(valor),
          currency: proposal.currency,
          dueDate: d,
          status: "PENDIENTE",
        });
      }
      await db.installment.createMany({ data: rows });
    }
  }

  await db.proposalLog.create({
    data: {
      organizationId: ctx.organizationId,
      proposalId,
      action: "PAYMENT_PLAN_UPDATED",
      summary: existing
        ? "Plan de pago actualizado"
        : "Plan de pago configurado",
      userId: ctx.userId,
    },
  });

  revalidatePath(`/propuestas/${proposalId}`);
  return { ok: true };
}

// ─── Bitácora ───────────────────────────────────────────────────────

export async function addProposalLogAction(
  proposalId: string,
  raw: ProposalLogValues,
): Promise<ActionResult> {
  const parsed = proposalLogSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { ctx, db } = await requireOrgDb();
  await db.proposalLog.create({
    data: {
      organizationId: ctx.organizationId,
      proposalId,
      action: parsed.data.action || "NOTE",
      summary: parsed.data.summary,
      nextDueDate: toDate(parsed.data.nextDueDate),
      responsibleUserId: toNullable(parsed.data.responsibleUserId),
      userId: ctx.userId,
    },
  });
  revalidatePath(`/propuestas/${proposalId}`);
  return { ok: true };
}
