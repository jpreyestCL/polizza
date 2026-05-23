import "server-only";
import { basePrisma, getDb } from "@/server/db";
import { logActivity } from "@/server/activity";
import { decryptSecret } from "@/lib/insurer-crypto";
import { getInsurerAdapter } from "./insurers";
import type { QuotationInput, ResolvedCredential } from "./insurers";

/** Bloqueo en memoria por cotización para evitar reprocesos concurrentes. */
const processing = new Set<string>();

const RC_MAP = {
  UF_500: 500,
  UF_1000: 1000,
  UF_1500: 1500,
  UF_2000: 2000,
} as const;

function buildQuotationInput(
  q: {
    patente: string;
    marca: string | null;
    modelo: string | null;
    anio: number | null;
    tipoVehiculo: string | null;
    motorizacion: string | null;
    vehicleCondition: "NUEVO" | "USADO";
    vehicleUse: "PARTICULAR" | "COMERCIAL";
    civilLiability: keyof typeof RC_MAP;
    workshopType: "EXCLUSIVIDAD" | "MARCA";
    deductibles: unknown;
  },
  client: { rut: string; name: string; birthDate: Date | null },
): QuotationInput {
  const deductiblesUf: number[] = Array.isArray(q.deductibles)
    ? (q.deductibles as unknown[])
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n))
    : [];
  return {
    patente: q.patente,
    marca: q.marca,
    modelo: q.modelo,
    anio: q.anio,
    tipoVehiculo: q.tipoVehiculo,
    motorizacion: q.motorizacion,
    vehicleCondition: q.vehicleCondition,
    vehicleUse: q.vehicleUse,
    civilLiabilityUf: RC_MAP[q.civilLiability],
    workshopType: q.workshopType,
    deductiblesUf,
    client,
  };
}

async function resolveCredential(
  organizationId: string,
  insurerKey: string,
): Promise<ResolvedCredential | null> {
  const cred = await basePrisma.insurerPortalCredential.findFirst({
    where: { organizationId, insurerKey, status: "ACTIVA" },
  });
  if (!cred) return null;
  try {
    const password = decryptSecret({
      ciphertext: cred.passwordEncrypted,
      iv: cred.passwordIv,
      tag: cred.passwordTag,
    });
    return { username: cred.username, password };
  } catch {
    return null;
  }
}

/**
 * Procesa una cotización completa: itera cada result pendiente, llama al
 * adaptador correspondiente y guarda el resultado. Idempotente: si una
 * result row está EN_PROCESO desde hace mucho, se puede volver a llamar para
 * retomarla (no se reanima automáticamente — usar reprocessResult).
 */
export async function runQuotationQueue(quotationId: string): Promise<void> {
  if (processing.has(quotationId)) return;
  processing.add(quotationId);
  try {
    const quotation = await basePrisma.carQuotation.findUnique({
      where: { id: quotationId },
      include: {
        client: { select: { rut: true, name: true, birthDate: true } },
        results: true,
      },
    });
    if (!quotation) return;

    const db = getDb(quotation.organizationId);
    const input = buildQuotationInput(quotation, quotation.client);
    const pending = quotation.results.filter((r) => r.status === "PENDIENTE");

    for (const result of pending) {
      await processResult(quotation.organizationId, quotation.id, result.id, input);
    }

    // Recalcular estado agregado.
    const fresh = await basePrisma.carQuotationResult.findMany({
      where: { quotationId: quotation.id },
      select: { status: true },
    });
    const anyPending = fresh.some(
      (r) => r.status === "PENDIENTE" || r.status === "EN_PROCESO",
    );
    const anyOk = fresh.some((r) => r.status === "OBTENIDA");
    const allError = fresh.every((r) => r.status === "ERROR");
    const newStatus = anyPending
      ? "EN_PROCESO"
      : allError
        ? "ERROR"
        : anyOk
          ? "COMPLETADA"
          : "ERROR";

    await db.carQuotation.update({
      where: { id: quotation.id },
      data: { status: newStatus },
    });

    await logActivity(db, {
      organizationId: quotation.organizationId,
      entityType: "CAR_QUOTATION",
      entityId: quotation.id,
      action: "quotation_processed",
      summary: `Cotización ${quotation.quotationNumber}: ${
        fresh.filter((r) => r.status === "OBTENIDA").length
      } resultado(s) obtenido(s), ${
        fresh.filter((r) => r.status === "ERROR").length
      } con error.`,
    });
  } finally {
    processing.delete(quotationId);
  }
}

async function processResult(
  organizationId: string,
  quotationId: string,
  resultId: string,
  input: QuotationInput,
): Promise<void> {
  const db = getDb(organizationId);
  const result = await db.carQuotationResult.findFirst({
    where: { id: resultId },
  });
  if (!result || result.status !== "PENDIENTE") return;

  await db.carQuotationResult.update({
    where: { id: resultId },
    data: { status: "EN_PROCESO", startedAt: new Date() },
  });

  const adapter = getInsurerAdapter(result.insurerKey);
  if (!adapter) {
    await db.carQuotationResult.update({
      where: { id: resultId },
      data: {
        status: "ERROR",
        errorMessage: `Aseguradora '${result.insurerKey}' no soportada.`,
        completedAt: new Date(),
      },
    });
    return;
  }

  let credential: ResolvedCredential | null = null;
  if (adapter.requiresCredentials) {
    credential = await resolveCredential(organizationId, adapter.key);
    if (!credential) {
      await db.carQuotationResult.update({
        where: { id: resultId },
        data: {
          status: "ERROR",
          errorMessage:
            "Faltan credenciales del portal. Configúralas en Configuración → Portales aseguradoras.",
          completedAt: new Date(),
        },
      });
      return;
    }
  }

  try {
    const quote = await adapter.quote(input, credential);
    await db.carQuotationResult.update({
      where: { id: resultId },
      data: {
        status: "OBTENIDA",
        premiumUf: quote.premiumUf.toString(),
        deductibleUf: quote.deductibleUf.toString(),
        planName: quote.planName,
        coverageDetail: quote.coverageDetail,
        rawData: quote.rawData,
        pdfBytes: new Uint8Array(quote.pdf),
        completedAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (error) {
    await db.carQuotationResult.update({
      where: { id: resultId },
      data: {
        status: "ERROR",
        errorMessage:
          error instanceof Error ? error.message : "Error desconocido.",
        completedAt: new Date(),
      },
    });
  }

  // Pequeña pausa entre aseguradoras para no saturar el portal real (cuando
  // se cambien los adaptadores simulados por scrapers reales).
  await new Promise((r) => setTimeout(r, 50));

  void quotationId; // mantener referencia explícita en caso de futuro logging.
}

/** Marca un result como PENDIENTE y dispara el procesamiento. */
export async function reprocessResult(
  organizationId: string,
  resultId: string,
): Promise<void> {
  const db = getDb(organizationId);
  const result = await db.carQuotationResult.findFirst({
    where: { id: resultId },
  });
  if (!result) return;
  await db.carQuotationResult.update({
    where: { id: resultId },
    data: {
      status: "PENDIENTE",
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    },
  });
  await db.carQuotation.update({
    where: { id: result.quotationId },
    data: { status: "EN_PROCESO" },
  });
  void runQuotationQueue(result.quotationId);
}
