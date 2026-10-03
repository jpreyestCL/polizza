import "server-only";
import type { InstallmentStatus } from "@prisma/client";
import type { SessionContext } from "@/server/context";
import type { Db } from "@/server/db";
import { canSeeAllClients } from "@/lib/roles";
import {
  buildPaginated,
  cursorArgs,
  type PageParams,
  type Paginated,
} from "@/lib/pagination";
import { isInstallmentOverdue } from "./overdue";

export type InstallmentItem = {
  id: string;
  number: number;
  amount: number;
  amountPaid: number | null;
  currency: string;
  dueDate: Date;
  status: InstallmentStatus;
  paidAt: Date | null;
  overdue: boolean;
  voidedByTermination: boolean;
};

export type InstallmentWithPolicy = InstallmentItem & {
  policyId: string;
  policyNumber: string;
  clientName: string;
  reminders: {
    id: string;
    kind: import("@prisma/client").CollectionReminderKind;
    sentTo: string;
    sentAt: Date;
  }[];
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
      amountPaid: true,
      currency: true,
      dueDate: true,
      status: true,
      paidAt: true,
      voidedByTermination: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
    amountPaid: row.amountPaid != null ? Number(row.amountPaid) : null,
    overdue: isInstallmentOverdue(row.status, row.dueDate),
  }));
}

/** Todas las cuotas de la cartera (paginadas, cursor) para la vista de Cobranza. */
export async function listAllInstallments(
  ctx: SessionContext,
  db: Db,
  page: PageParams,
  q?: string,
): Promise<Paginated<InstallmentWithPolicy>> {
  const term = q?.trim();
  const where = {
    policyId: { not: null },
    ...(canSeeAllClients(ctx.role)
      ? {}
      : { policy: { assignedUserId: ctx.userId } }),
    // Búsqueda por N° de póliza o nombre del cliente de esa póliza.
    ...(term
      ? {
          policy: {
            ...(canSeeAllClients(ctx.role)
              ? {}
              : { assignedUserId: ctx.userId }),
            OR: [
              { policyNumber: { contains: term, mode: "insensitive" as const } },
              {
                client: {
                  name: { contains: term, mode: "insensitive" as const },
                },
              },
            ],
          },
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.installment.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      ...cursorArgs(page),
      select: {
        id: true,
        number: true,
        amount: true,
        amountPaid: true,
        currency: true,
        dueDate: true,
        status: true,
        paidAt: true,
        voidedByTermination: true,
        policyId: true,
        policy: {
          select: {
            policyNumber: true,
            client: { select: { name: true } },
          },
        },
        reminders: {
          orderBy: { sentAt: "desc" },
          take: 3,
          select: { id: true, kind: true, sentTo: true, sentAt: true },
        },
      },
    }),
    db.installment.count({ where }),
  ]);
  const enriched: InstallmentWithPolicy[] = rows
    .filter(
      (row): row is typeof row & {
        policyId: string;
        policy: NonNullable<typeof row.policy>;
      } => row.policyId !== null && row.policy !== null,
    )
    .map((row) => ({
      id: row.id,
      number: row.number,
      amount: Number(row.amount),
      amountPaid: row.amountPaid != null ? Number(row.amountPaid) : null,
      currency: row.currency,
      dueDate: row.dueDate,
      status: row.status,
      paidAt: row.paidAt,
      voidedByTermination: row.voidedByTermination,
      overdue: isInstallmentOverdue(row.status, row.dueDate),
      policyId: row.policyId,
      policyNumber: row.policy.policyNumber,
      clientName: row.policy.client.name,
      reminders: row.reminders,
    }));
  return buildPaginated(enriched, page, total);
}
