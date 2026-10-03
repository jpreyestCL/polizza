"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requireOrgDb } from "@/server/context";
import { hasPermission } from "@/lib/factory-roles";
import { matchCommissionLines } from "@/lib/domain/commission-match";
import { parseCommissionLines } from "@/lib/domain/commission-lines";
import { withinCommissionTolerance } from "@/lib/domain/money";

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Carga una liquidación línea a línea (número de póliza y monto) y la
 * calza contra la comisión esperada de esa póliza.
 */
export async function postCommissionStatementAction(form: FormData): Promise<void> {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "commissions.reconcile")) {
    redirect("/comisiones?error=permiso");
  }
  const insurerName = text(form, "insurerName");
  const currency = text(form, "currency") || "UF";
  const uploaded = form.get("file");
  const fileText =
    uploaded instanceof File && uploaded.size > 0 ? await uploaded.text() : "";
  const parsed = [
    ...parseCommissionLines(text(form, "lines"), currency),
    ...parseCommissionLines(fileText, currency),
  ];
  if (!insurerName || parsed.length === 0) {
    redirect("/comisiones/liquidacion?error=datos");
  }

  const policies = await db.policy.findMany({
    where: { policyNumber: { in: parsed.map((line) => line.policyNumber) } },
    select: { id: true, policyNumber: true },
  });
  const policyId = new Map(policies.map((policy) => [policy.policyNumber, policy.id]));
  const receivables = await db.commissionReceivable.findMany({
    where: {
      status: "PENDING",
      policyId: { in: policies.map((policy) => policy.id) },
    },
    select: {
      id: true,
      amount: true,
      currency: true,
      policy: { select: { policyNumber: true } },
    },
  });

  const statement = await db.commissionStatement.create({
    data: {
      organizationId: ctx.organizationId,
      insurerName,
      currency,
      status: "POSTED",
    },
  });
  const lineIds: { id: string; policyNumber: string; amount: number }[] = [];
  for (const line of parsed) {
    const created = await db.commissionStatementLine.create({
      data: {
        organizationId: ctx.organizationId,
        statementId: statement.id,
        policyNumber: line.policyNumber,
        amount: new Prisma.Decimal(line.amount.toFixed(4)),
        currency,
      },
    });
    lineIds.push({ id: created.id, policyNumber: line.policyNumber, amount: line.amount });
  }
  const matches = matchCommissionLines(
    lineIds.map((line) => ({
      id: line.id,
      policyNumber: line.policyNumber,
      amount: line.amount,
      currency,
    })),
    receivables
      .filter((row) => row.currency === currency)
      .map((row) => ({
        id: row.id,
        policyNumber: row.policy.policyNumber,
        amount: Number(row.amount),
        currency: row.currency,
      })),
  );
  if (matches.length > 0) {
    await db.commissionAllocation.createMany({
      data: matches.map((match) => ({
        organizationId: ctx.organizationId,
        lineId: match.lineId,
        receivableId: match.receivableId,
        amount: new Prisma.Decimal(match.amount.toFixed(4)),
      })),
    });
  }
  const allocated = new Map<string, number>();
  for (const match of matches) {
    allocated.set(
      match.receivableId,
      (allocated.get(match.receivableId) ?? 0) + match.amount,
    );
  }
  const settled = receivables
    .filter((row) =>
      withinCommissionTolerance(Number(row.amount), allocated.get(row.id) ?? 0),
    )
    .map((row) => row.id);
  if (settled.length > 0) {
    await db.commissionReceivable.updateMany({
      where: { id: { in: settled } },
      data: { status: "SETTLED" },
    });
  }
  const missing = parsed
    .filter((line) => !policyId.has(line.policyNumber))
    .map((line) => line.policyNumber);
  const matchedPolicies = new Set(matches.map((match) => match.lineId));
  const withoutReceivable = lineIds
    .filter(
      (line) =>
        line.amount > 0 &&
        policyId.has(line.policyNumber) &&
        !matchedPolicies.has(line.id),
    )
    .map((line) => line.policyNumber);
  const adjustments = lineIds
    .filter((line) => line.amount < 0)
    .map((line) => line.policyNumber);
  revalidatePath("/comisiones/liquidacion");
  const faltan = missing.slice(0, 12).join(",");
  const sinComision = withoutReceivable.slice(0, 12).join(",");
  const ajustes = adjustments.slice(0, 12).join(",");
  redirect(
    `/comisiones/liquidacion?ok=1&lineas=${parsed.length}&calces=${matches.length}&sinPoliza=${missing.length}&sinComision=${withoutReceivable.length}&faltan=${encodeURIComponent(faltan)}&pendientes=${encodeURIComponent(sinComision)}&negativos=${adjustments.length}&ajustes=${encodeURIComponent(ajustes)}`,
  );
}
