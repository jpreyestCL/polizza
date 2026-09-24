"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { logActivity } from "@/server/activity";
import { canManageCommissions, canEditCommissionRates } from "@/lib/roles";
import {
  brokerCommissionOf,
  appliedSellerPct,
  sellerPayout,
  totalCompanyPaid,
  isPaidByCompany,
  round2,
} from "@/lib/commissions";
import {
  companyPaymentSchema,
  policyCommissionSchema,
  salespersonRateSchema,
  policySalesCommissionSchema,
  generateSettlementSchema,
  type CompanyPaymentValues,
  type PolicyCommissionValues,
  type SalespersonRateValues,
  type PolicySalesCommissionValues,
  type GenerateSettlementValues,
} from "./schemas";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ── Pagos de la compañía ──────────────────────────────────────

export async function registerCompanyPaymentAction(
  values: CompanyPaymentValues,
): Promise<ActionResult> {
  const parsed = companyPaymentSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisa los datos del pago.",
    };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();
  if (!canManageCommissions(ctx.role)) {
    return { ok: false, error: "No tienes permiso para registrar pagos." };
  }

  const policy = await db.policy.findFirst({
    where: { id: data.policyId },
    select: {
      id: true,
      policyNumber: true,
      currency: true,
      sellerCommissionItem: { select: { id: true } },
    },
  });
  if (!policy) {
    return { ok: false, error: "La póliza no existe o no tienes acceso." };
  }
  if (data.decision === "PENDING" && policy.sellerCommissionItem) {
    return {
      ok: false,
      error:
        "La comisión del vendedor de esta póliza ya fue liquidada; no se puede dejar pendiente.",
    };
  }

  const paymentDate = parseDate(data.paymentDate);
  if (!paymentDate) {
    return {
      ok: false,
      error: "Fecha de pago inválida.",
      fieldErrors: { paymentDate: "Fecha inválida" },
    };
  }
  // Sin tipo de cambio un pago en otra moneda no se puede comparar con la
  // comisión (quedaría sumando 0): se exige el informado o el implícito.
  if (data.currency !== policy.currency && !data.exchangeFactor) {
    return {
      ok: false,
      error: `Ingresa el tipo de cambio ${policy.currency} → ${data.currency}.`,
      fieldErrors: { exchangeFactor: "Tipo de cambio requerido" },
    };
  }

  const paid = data.decision === "PAID";
  const payment = await db.$transaction(async (tx) => {
    const created = await tx.companyCommissionPayment.create({
      data: {
        organizationId: ctx.organizationId,
        policyId: data.policyId,
        paymentDate,
        amount: data.amount,
        currency: data.currency,
        invoiceNumber: emptyToNull(data.invoiceNumber),
        invoiceDate: parseDate(data.invoiceDate),
        exchangeFactor:
          data.currency === policy.currency
            ? null
            : emptyToNull(data.exchangeFactor),
        notes: emptyToNull(data.notes),
        createdById: ctx.userId,
      },
    });
    await tx.policy.update({
      where: { id: policy.id },
      data: { commissionPaid: paid },
    });
    return created;
  });

  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "POLICY",
    entityId: policy.id,
    action: "company_commission_paid",
    summary: paid
      ? `Pago de comisión de compañía registrado en póliza ${policy.policyNumber} · comisión pagada`
      : `Pago de comisión de compañía registrado en póliza ${policy.policyNumber} · comisión queda pendiente`,
    userId: ctx.userId,
  });

  revalidatePath("/comisiones");
  revalidatePath("/liquidaciones-vendedores");
  return { ok: true, id: payment.id };
}

/**
 * Deja la comisión de la póliza pagada (true), pendiente (false) o vuelve al
 * cálculo automático por suma de pagos (null), sin registrar un pago nuevo.
 */
export async function setCommissionPaidAction(
  policyId: string,
  paid: boolean | null,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!canManageCommissions(ctx.role)) {
    return { ok: false, error: "No tienes permiso." };
  }
  const policy = await db.policy.findFirst({
    where: { id: policyId },
    select: {
      id: true,
      policyNumber: true,
      sellerCommissionItem: { select: { id: true } },
    },
  });
  if (!policy) {
    return { ok: false, error: "La póliza no existe o no tienes acceso." };
  }
  if (paid !== true && policy.sellerCommissionItem) {
    return {
      ok: false,
      error:
        "La comisión del vendedor de esta póliza ya fue liquidada; elimina la liquidación antes de dejarla pendiente.",
    };
  }
  await db.policy.update({
    where: { id: policyId },
    data: { commissionPaid: paid },
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "POLICY",
    entityId: policyId,
    action: "company_commission_status",
    summary:
      paid === true
        ? `Comisión de póliza ${policy.policyNumber} dejada como pagada por la compañía`
        : paid === false
          ? `Comisión de póliza ${policy.policyNumber} dejada pendiente`
          : `Comisión de póliza ${policy.policyNumber} vuelve a cálculo automático`,
    userId: ctx.userId,
  });
  revalidatePath("/comisiones");
  revalidatePath("/liquidaciones-vendedores");
  return { ok: true, id: policyId };
}

export async function deleteCompanyPaymentAction(
  id: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!canManageCommissions(ctx.role)) {
    return { ok: false, error: "No tienes permiso." };
  }
  const existing = await db.companyCommissionPayment.findFirst({
    where: { id },
    select: { id: true, policyId: true },
  });
  if (!existing) return { ok: false, error: "El pago no existe." };
  // Al quitar un pago la decisión anterior (pagada/pendiente) ya no aplica:
  // la comisión vuelve al cálculo automático por suma de pagos.
  await db.$transaction(async (tx) => {
    await tx.companyCommissionPayment.delete({ where: { id } });
    await tx.policy.update({
      where: { id: existing.policyId },
      data: { commissionPaid: null },
    });
  });
  revalidatePath("/comisiones");
  revalidatePath("/liquidaciones-vendedores");
  return { ok: true, id };
}

/**
 * Corrige la comisión de la póliza desde la revisión de comisiones, cuando la
 * diferencia con lo pagado por la compañía se debe a un dato mal registrado en
 * el sistema (prima neta o % de comisión).
 */
export async function updatePolicyCommissionAction(
  policyId: string,
  values: PolicyCommissionValues,
): Promise<ActionResult> {
  const parsed = policyCommissionSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisa los datos.",
    };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();
  if (!canManageCommissions(ctx.role)) {
    return { ok: false, error: "No tienes permiso." };
  }
  const policy = await db.policy.findFirst({
    where: { id: policyId },
    select: { id: true, policyNumber: true },
  });
  if (!policy) {
    return { ok: false, error: "La póliza no existe o no tienes acceso." };
  }
  await db.policy.update({
    where: { id: policyId },
    data: {
      premiumNet: data.premiumNet === "" ? null : data.premiumNet,
      commissionPercent:
        data.commissionPercent === "" ? null : data.commissionPercent,
      commissionAmount:
        data.commissionAmount === "" ? null : data.commissionAmount,
    },
  });
  await logActivity(db, {
    organizationId: ctx.organizationId,
    entityType: "POLICY",
    entityId: policyId,
    action: "commission_updated",
    summary: `Comisión de póliza ${policy.policyNumber} corregida desde revisión de comisiones`,
    userId: ctx.userId,
  });
  revalidatePath("/comisiones");
  revalidatePath("/liquidaciones-vendedores");
  revalidatePath(`/polizas/${policyId}`);
  return { ok: true, id: policyId };
}

// ── Vendedor / tasa por póliza ────────────────────────────────

export async function updatePolicySalesCommissionAction(
  policyId: string,
  values: PolicySalesCommissionValues,
): Promise<ActionResult> {
  const parsed = policySalesCommissionSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();
  // Cualquier gestor puede asignar el vendedor; solo el admin baja el % (deal).
  if (!canManageCommissions(ctx.role)) {
    return { ok: false, error: "No tienes permiso." };
  }
  if (data.salesCommissionPct !== "" && !canEditCommissionRates(ctx.role)) {
    return {
      ok: false,
      error: "Solo el administrador puede ajustar el % de comisión.",
    };
  }

  const policy = await db.policy.findFirst({
    where: { id: policyId },
    select: { id: true, policyNumber: true },
  });
  if (!policy) {
    return { ok: false, error: "La póliza no existe o no tienes acceso." };
  }

  await db.policy.update({
    where: { id: policyId },
    data: {
      salespersonId: emptyToNull(data.salespersonId),
      salesCommissionPct:
        data.salesCommissionPct === "" ? null : data.salesCommissionPct,
    },
  });

  revalidatePath("/comisiones");
  revalidatePath("/liquidaciones-vendedores");
  return { ok: true, id: policyId };
}

// ── Tasas default por vendedor (admin) ────────────────────────

export async function upsertSalespersonRateAction(
  values: SalespersonRateValues,
): Promise<ActionResult> {
  const parsed = salespersonRateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos de la tasa." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();
  if (!canEditCommissionRates(ctx.role)) {
    return { ok: false, error: "Solo el administrador puede editar tasas." };
  }

  const existing = await db.salespersonCommissionRate.findFirst({
    where: { userId: data.userId },
    select: { id: true },
  });

  if (existing) {
    await db.salespersonCommissionRate.update({
      where: { id: existing.id },
      data: { defaultPct: data.defaultPct, isActive: data.isActive },
    });
    revalidatePath("/configuracion/comisiones-vendedores");
    return { ok: true, id: existing.id };
  }

  const created = await db.salespersonCommissionRate.create({
    data: {
      organizationId: ctx.organizationId,
      userId: data.userId,
      defaultPct: data.defaultPct,
      isActive: data.isActive,
      createdById: ctx.userId,
    },
  });
  revalidatePath("/configuracion/comisiones-vendedores");
  return { ok: true, id: created.id };
}

export async function deleteSalespersonRateAction(
  id: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!canEditCommissionRates(ctx.role)) {
    return { ok: false, error: "Solo el administrador puede editar tasas." };
  }
  const existing = await db.salespersonCommissionRate.findFirst({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "La tasa no existe." };
  await db.salespersonCommissionRate.delete({ where: { id } });
  revalidatePath("/configuracion/comisiones-vendedores");
  return { ok: true, id };
}

// ── Liquidaciones de vendedores ───────────────────────────────

export async function generateSettlementAction(
  values: GenerateSettlementValues,
): Promise<ActionResult> {
  const parsed = generateSettlementSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Selecciona vendedor y pólizas." };
  }
  const data = parsed.data;
  const { ctx, db } = await requireOrgDb();
  if (!canManageCommissions(ctx.role)) {
    return { ok: false, error: "No tienes permiso para liquidar comisiones." };
  }

  // Tasa default del vendedor (para pólizas sin override).
  const rate = await db.salespersonCommissionRate.findFirst({
    where: { userId: data.salespersonId },
    select: { defaultPct: true, isActive: true },
  });
  const defaultPct = rate && rate.isActive ? Number(rate.defaultPct) : null;

  // Re-calcula del lado servidor: no confía en montos del cliente.
  const policies = await db.policy.findMany({
    where: {
      id: { in: data.policyIds },
      salespersonId: data.salespersonId,
      sellerCommissionItem: { is: null },
    },
    select: {
      id: true,
      currency: true,
      premiumNet: true,
      commissionPercent: true,
      commissionAmount: true,
      salesCommissionPct: true,
      commissionPaid: true,
      companyCommissionPayments: {
        select: { amount: true, currency: true, exchangeFactor: true },
      },
    },
  });

  const items = policies
    .map((p) => {
      const brokerCommission = brokerCommissionOf({
        commissionAmount:
          p.commissionAmount != null ? Number(p.commissionAmount) : null,
        premiumNet: p.premiumNet != null ? Number(p.premiumNet) : null,
        commissionPercent:
          p.commissionPercent != null ? Number(p.commissionPercent) : null,
      });
      const companyPaid = totalCompanyPaid(
        p.companyCommissionPayments.map((cp) => ({
          amount: Number(cp.amount),
          currency: cp.currency,
          exchangeFactor:
            cp.exchangeFactor != null ? Number(cp.exchangeFactor) : null,
        })),
        p.currency,
      );
      if (!isPaidByCompany(brokerCommission, companyPaid, p.commissionPaid)) {
        return null;
      }
      const pct = appliedSellerPct(
        p.salesCommissionPct != null ? Number(p.salesCommissionPct) : null,
        defaultPct,
      );
      if (pct == null) return null;
      return {
        policyId: p.id,
        currency: p.currency,
        baseCommissionAmount: brokerCommission,
        appliedPct: pct,
        amount: sellerPayout(brokerCommission, pct),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (items.length === 0) {
    return {
      ok: false,
      error:
        "Ninguna póliza seleccionada es liquidable (debe estar pagada por la compañía, no liquidada y con tasa de vendedor).",
    };
  }

  // Una liquidación agrupa una sola moneda: la comisión del vendedor se calcula
  // en la moneda de cada póliza y no se mezclan en un total.
  const currencies = new Set(items.map((it) => it.currency));
  if (currencies.size > 1) {
    return {
      ok: false,
      error:
        "Las pólizas seleccionadas tienen distintas monedas. Genera una liquidación por moneda.",
    };
  }
  const settlementCurrency = items[0].currency;
  const total = round2(items.reduce((acc, it) => acc + it.amount, 0));

  try {
    const settlement = await db.$transaction(async (tx) => {
      const max = await tx.sellerCommissionSettlement.aggregate({
        _max: { number: true },
      });
      const nextNumber = (max._max.number ?? 0) + 1;
      const created = await tx.sellerCommissionSettlement.create({
        data: {
          organizationId: ctx.organizationId,
          salespersonId: data.salespersonId,
          number: nextNumber,
          status: "PENDIENTE",
          currency: settlementCurrency,
          totalAmount: total,
          notes: emptyToNull(data.notes),
          createdById: ctx.userId,
        },
      });
      await tx.sellerCommissionSettlementItem.createMany({
        data: items.map((it) => ({
          organizationId: ctx.organizationId,
          settlementId: created.id,
          policyId: it.policyId,
          baseCommissionAmount: it.baseCommissionAmount,
          appliedPct: it.appliedPct,
          amount: it.amount,
          currency: it.currency,
        })),
      });
      return created;
    });

    revalidatePath("/liquidaciones-vendedores");
    revalidatePath("/comisiones");
    return { ok: true, id: settlement.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(",")
        : String(error.meta?.target ?? "");
      // Colisión de correlativo (dos liquidaciones simultáneas) vs. póliza ya
      // liquidada: mensajes distintos para no confundir al usuario.
      if (target.includes("number")) {
        return {
          ok: false,
          error:
            "Se generó otra liquidación al mismo tiempo. Vuelve a intentar.",
        };
      }
      return {
        ok: false,
        error:
          "Una de las pólizas ya está en otra liquidación. Recarga y vuelve a intentar.",
      };
    }
    throw error;
  }
}

export async function markSettlementPaidAction(
  id: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!canManageCommissions(ctx.role)) {
    return { ok: false, error: "No tienes permiso." };
  }
  const existing = await db.sellerCommissionSettlement.findFirst({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) return { ok: false, error: "La liquidación no existe." };
  if (existing.status === "PAGADA") {
    return { ok: false, error: "La liquidación ya está pagada." };
  }
  await db.sellerCommissionSettlement.update({
    where: { id },
    data: { status: "PAGADA", paidAt: new Date() },
  });
  revalidatePath("/liquidaciones-vendedores");
  revalidatePath(`/liquidaciones-vendedores/${id}`);
  return { ok: true, id };
}

export async function deleteSettlementAction(
  id: string,
): Promise<ActionResult> {
  const { ctx, db } = await requireOrgDb();
  if (!canManageCommissions(ctx.role)) {
    return { ok: false, error: "No tienes permiso." };
  }
  const existing = await db.sellerCommissionSettlement.findFirst({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) return { ok: false, error: "La liquidación no existe." };
  if (existing.status === "PAGADA") {
    return {
      ok: false,
      error: "No puedes eliminar una liquidación ya pagada.",
    };
  }
  // Borra la liquidación; los items caen por cascade y liberan las pólizas.
  await db.sellerCommissionSettlement.delete({ where: { id } });
  revalidatePath("/liquidaciones-vendedores");
  revalidatePath("/comisiones");
  return { ok: true, id };
}
