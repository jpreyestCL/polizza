import "server-only";
import type { SessionContext } from "@/server/context";
import type { Db } from "@/server/db";
import { canSeeAllClients } from "@/lib/roles";

export type CarQuotationListItem = {
  id: string;
  quotationNumber: string;
  status: string;
  patente: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  assignedUserId: string | null;
  createdAt: Date;
  client: { id: string; name: string };
  resultsCount: number;
  obtainedCount: number;
  bestPremiumUf: number | null;
};

export async function listCarQuotations(
  ctx: SessionContext,
  db: Db,
): Promise<CarQuotationListItem[]> {
  const rows = await db.carQuotation.findMany({
    where: canSeeAllClients(ctx.role) ? {} : { assignedUserId: ctx.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      quotationNumber: true,
      status: true,
      patente: true,
      marca: true,
      modelo: true,
      anio: true,
      assignedUserId: true,
      createdAt: true,
      client: { select: { id: true, name: true } },
      results: {
        select: { status: true, premiumUf: true },
      },
    },
  });
  return rows.map((r) => {
    const obtained = r.results.filter((x) => x.status === "OBTENIDA");
    const best =
      obtained.length === 0
        ? null
        : Math.min(...obtained.map((x) => Number(x.premiumUf ?? 0)));
    return {
      id: r.id,
      quotationNumber: r.quotationNumber,
      status: r.status,
      patente: r.patente,
      marca: r.marca,
      modelo: r.modelo,
      anio: r.anio,
      assignedUserId: r.assignedUserId,
      createdAt: r.createdAt,
      client: r.client,
      resultsCount: r.results.length,
      obtainedCount: obtained.length,
      bestPremiumUf: best,
    };
  });
}

export async function getCarQuotationDetail(db: Db, id: string) {
  const q = await db.carQuotation.findFirst({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          rut: true,
          contacts: {
            select: { id: true, name: true, email: true, isPrimary: true },
            where: { email: { not: null } },
            orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
          },
          email: true,
        },
      },
      results: {
        orderBy: [{ premiumUf: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          insurerKey: true,
          insurerName: true,
          status: true,
          premiumUf: true,
          deductibleUf: true,
          planName: true,
          coverageDetail: true,
          errorMessage: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
          pdfBytes: false,
        },
      },
    },
  });
  if (!q) return null;
  return {
    ...q,
    results: q.results.map((r) => ({
      ...r,
      premiumUf: r.premiumUf ? Number(r.premiumUf) : null,
      deductibleUf: r.deductibleUf ? Number(r.deductibleUf) : null,
    })),
  };
}

export type CarQuotationDetail = NonNullable<
  Awaited<ReturnType<typeof getCarQuotationDetail>>
>;

export async function listClientCarQuotations(db: Db, clientId: string) {
  const rows = await db.carQuotation.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      quotationNumber: true,
      status: true,
      patente: true,
      marca: true,
      modelo: true,
      anio: true,
      createdAt: true,
      results: { select: { status: true, premiumUf: true } },
    },
  });
  return rows.map((r) => {
    const obtained = r.results.filter((x) => x.status === "OBTENIDA");
    const best =
      obtained.length === 0
        ? null
        : Math.min(...obtained.map((x) => Number(x.premiumUf ?? 0)));
    return {
      id: r.id,
      quotationNumber: r.quotationNumber,
      status: r.status,
      patente: r.patente,
      marca: r.marca,
      modelo: r.modelo,
      anio: r.anio,
      createdAt: r.createdAt,
      bestPremiumUf: best,
    };
  });
}

export async function getCarQuotationActivity(db: Db, quotationId: string) {
  return db.activityLog.findMany({
    where: { entityType: "CAR_QUOTATION", entityId: quotationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/** Solo metadata + bytes binarios de un PDF de result, para servirlo en una route. */
export async function getResultPdf(
  db: Db,
  resultId: string,
): Promise<{
  pdfBytes: Buffer;
  insurerName: string;
  quotationNumber: string;
} | null> {
  const r = await db.carQuotationResult.findFirst({
    where: { id: resultId },
    select: {
      pdfBytes: true,
      insurerName: true,
      quotation: { select: { quotationNumber: true } },
    },
  });
  if (!r?.pdfBytes) return null;
  return {
    pdfBytes: Buffer.from(r.pdfBytes),
    insurerName: r.insurerName,
    quotationNumber: r.quotation.quotationNumber,
  };
}
