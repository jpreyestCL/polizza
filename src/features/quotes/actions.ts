"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { basePrisma } from "@/server/db";
import { hasPermission } from "@/lib/factory-roles";
import { sensitiveReasonError } from "@/lib/domain/sensitive-reason";
import { canMoveQuote, quoteNeedsOffer } from "@/lib/domain/quote-flow";
import { generateProposalNumber } from "@/features/proposals/number-generator";
import { logActivity } from "@/server/activity";
import { featureEnabled } from "@/server/tenant-features";

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createQuoteRequestAction(form: FormData): Promise<void> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "quotes.write")) {
    redirect("/cotizaciones-comparativo?error=permiso");
  }
  if (!(await featureEnabled(db, ctx.organizationId, "QUOTE_COMPARATOR"))) {
    redirect("/cotizaciones-comparativo?error=FEATURE_DISABLED");
  }
  const clientId = text(form, "clientId");
  const title = text(form, "title");
  if (!clientId || title.length < 3) {
    redirect("/cotizaciones-comparativo?error=datos");
  }
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { id: true },
  });
  if (!client) redirect("/cotizaciones-comparativo?error=cliente");
  const created = await db.quoteRequest.create({
    data: {
      organizationId: ctx.organizationId,
      clientId,
      title,
      currency: text(form, "currency") || "UF",
      assignedUserId: ctx.userId,
      createdById: ctx.userId,
    },
  });
  revalidatePath("/cotizaciones-comparativo");
  redirect(`/cotizaciones-comparativo/${created.id}`);
}

export async function addQuoteOfferAction(form: FormData): Promise<void> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "quotes.write")) return;
  const requestId = text(form, "requestId");
  const insurerName = text(form, "insurerName");
  const premiumRaw = text(form, "premiumNet");
  const request = await db.quoteRequest.findFirst({
    where: { id: requestId },
    select: { id: true, status: true },
  });
  if (!request || request.status === "GANADA" || request.status === "PERDIDA") {
    return;
  }
  if (insurerName.length < 2) {
    redirect(`/cotizaciones-comparativo/${requestId}?error=compania`);
  }
  const premium = premiumRaw === "" ? null : Number(premiumRaw);
  if (premium != null && !Number.isFinite(premium)) {
    redirect(`/cotizaciones-comparativo/${requestId}?error=prima`);
  }
  if (text(form, "recommended") === "1") {
    await db.quoteOffer.updateMany({
      where: { requestId },
      data: { recommended: false },
    });
  }
  await db.quoteOffer.create({
    data: {
      organizationId: ctx.organizationId,
      requestId,
      insurerName,
      premiumNet: premium == null ? null : new Prisma.Decimal(premium.toFixed(4)),
      currency: text(form, "currency") || "UF",
      notes: text(form, "notes") || null,
      recommended: text(form, "recommended") === "1",
    },
  });
  revalidatePath(`/cotizaciones-comparativo/${requestId}`);
  redirect(`/cotizaciones-comparativo/${requestId}`);
}

export async function moveQuoteRequestAction(form: FormData): Promise<void> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "quotes.write")) return;
  const requestId = text(form, "requestId");
  const to = text(form, "status");
  const request = await db.quoteRequest.findFirst({
    where: { id: requestId },
    include: { offers: true, client: { select: { name: true } } },
  });
  if (!request) return;
  if (!canMoveQuote(request.status, to)) {
    redirect(`/cotizaciones-comparativo/${requestId}?error=estado`);
  }
  if (quoteNeedsOffer(to) && request.offers.length === 0) {
    redirect(`/cotizaciones-comparativo/${requestId}?error=oferta`);
  }
  if (to === "PERDIDA") {
    const reasonError = sensitiveReasonError(text(form, "lossReason"));
    if (reasonError) {
      redirect(`/cotizaciones-comparativo/${requestId}?error=motivo`);
    }
    await db.quoteRequest.update({
      where: { id: requestId },
      data: { status: "PERDIDA", lossReason: text(form, "lossReason") },
    });
    revalidatePath(`/cotizaciones-comparativo/${requestId}`);
    redirect(`/cotizaciones-comparativo/${requestId}`);
  }
  if (to === "GANADA") {
    const recommended =
      request.offers.find((offer) => offer.recommended) ?? request.offers[0];
    const proposalNumber = await generateProposalNumber(
      basePrisma,
      ctx.organizationId,
    );
    const proposal = await db.proposal.create({
      data: {
        organizationId: ctx.organizationId,
        clientId: request.clientId,
        proposalNumber,
        status: "ELABORACION",
        currency: recommended?.currency ?? request.currency,
        premiumNet: recommended?.premiumNet ?? null,
        observations: `Nace de la cotización “${request.title}”. Compañía recomendada: ${recommended?.insurerName ?? "sin oferta"}.`,
        assignedUserId: request.assignedUserId ?? ctx.userId,
        createdById: ctx.userId,
      },
    });
    const { ensureDraftPolicy } = await import("@/features/policies/draft-policy");
    await db.$transaction(async (tx) => {
      await ensureDraftPolicy(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        proposalId: proposal.id,
      });
    });
    await db.quoteRequest.update({
      where: { id: requestId },
      data: { status: "GANADA", proposalId: proposal.id },
    });
    await logActivity(db, {
      organizationId: ctx.organizationId,
      entityType: "PROPOSAL",
      entityId: proposal.id,
      action: "created_from_quote",
      summary: `Propuesta ${proposalNumber} creada desde la cotización de ${request.client.name}`,
      userId: ctx.userId,
    });
    revalidatePath("/propuestas");
    redirect(`/propuestas/${proposal.id}`);
  }
  await db.quoteRequest.update({
    where: { id: requestId },
    data: { status: to as "SOLICITADA" | "COTIZADA" | "ENVIADA_CLIENTE" },
  });
  revalidatePath(`/cotizaciones-comparativo/${requestId}`);
  redirect(`/cotizaciones-comparativo/${requestId}`);
}
