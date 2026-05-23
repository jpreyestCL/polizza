import "server-only";
import type { InstallmentStatus } from "@prisma/client";
import type { SessionContext } from "@/server/context";
import type { Db } from "@/server/db";
import { canSeeAllClients } from "@/lib/roles";
import { isInstallmentOverdue } from "./overdue";

export type InstallmentItem = {
  id: string;
  number: number;
  amount: number;
  currency: string;
  dueDate: Date;
  status: InstallmentStatus;
  paidAt: Date | null;
  overdue: boolean;
};

export type InstallmentWithPolicy = InstallmentItem & {
  policyId: string;
  policyNumber: string;
  clientName: string;
};

/** Cuotas de una póliza, ordenadas por número. */
export async function listPolicyInstallments(
  db: Db,
  policyId: string,
): Promise<InstallmentItem[]> {
  const rows = await db.installment.findMany({
    where: { policyId },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      amount: true,
      currency: true,
      dueDate: true,
      status: true,
      paidAt: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
    overdue: isInstallmentOverdue(row.status, row.dueDate),
  }));
}

/** Todas las cuotas de la cartera, acotadas por rol, para la vista de Cobranza. */
export async function listAllInstallments(
  ctx: SessionContext,
  db: Db,
): Promise<InstallmentWithPolicy[]> {
  const rows = await db.installment.findMany({
    where: {
      policyId: { not: null },
      ...(canSeeAllClients(ctx.role)
        ? {}
        : { policy: { assignedUserId: ctx.userId } }),
    },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      number: true,
      amount: true,
      currency: true,
      dueDate: true,
      status: true,
      paidAt: true,
      policyId: true,
      policy: {
        select: {
          policyNumber: true,
          client: { select: { name: true } },
        },
      },
    },
  });
  return rows
    .filter((row): row is typeof row & { policyId: string; policy: NonNullable<typeof row.policy> } => row.policyId !== null && row.policy !== null)
    .map((row) => ({
      id: row.id,
      number: row.number,
      amount: Number(row.amount),
      currency: row.currency,
      dueDate: row.dueDate,
      status: row.status,
      paidAt: row.paidAt,
      overdue: isInstallmentOverdue(row.status, row.dueDate),
      policyId: row.policyId,
      policyNumber: row.policy.policyNumber,
      clientName: row.policy.client.name,
    }));
}
