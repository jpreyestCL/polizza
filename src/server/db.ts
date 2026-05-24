import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Cliente Prisma base, sin scoping de tenant. Úsalo solo para:
 * - tablas globales (Currency, ExchangeRate, Holiday)
 * - tablas de Better Auth
 * - AuditLog (eventos de seguridad, pueden no tener organización)
 * Para cualquier tabla de dominio usa getDb(organizationId).
 */
export const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

/**
 * Modelos de dominio aislados por organización. Cada operación sobre estos
 * modelos recibe automáticamente el filtro/valor organizationId.
 */
const TENANT_MODELS = new Set<string>([
  "InsuranceCompany",
  "InsuranceCompanyContact",
  "InsuranceLine",
  "InsuranceProduct",
  "TenantProductCoverage",
  "Client",
  "ClientContact",
  "ClientRelationship",
  "ClientTag",
  "ClientTagAssignment",
  "Holding",
  "Branch",
  "Proposal",
  "ProposalItem",
  "ProposalItemCoverage",
  "PaymentPlan",
  "ProposalLog",
  "ProposalStatusHistory",
  "ProposalReturnReason",
  "Policy",
  "PolicyItem",
  "PolicyCoverage",
  "PolicyStatusHistory",
  "Endorsement",
  "Claim",
  "ClaimStatusHistory",
  "ClaimThirdParty",
  "ClaimLog",
  "Installment",
  "Task",
  "Alert",
  "Comment",
  "ActivityLog",
  "Document",
  "DocumentVersion",
  "CarQuotation",
  "CarQuotationResult",
  "InsurerPortalCredential",
  "Broker",
  "ProposalBrokerParticipation",
  "ProposalCoaseguroParticipation",
]);

// Operaciones cuyo `where` debe filtrarse por organizationId.
const WHERE_OPS = new Set<string>([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
  "update",
  "delete",
  "upsert",
]);

/**
 * Devuelve un cliente Prisma extendido y atado a una organización.
 *
 * Garantía: toda lectura/escritura sobre un modelo de dominio queda acotada a
 * `organizationId`. Es imposible (sin SQL crudo) leer o mutar datos de otro
 * tenant a través de este cliente.
 *
 * Nota sobre escrituras anidadas: las creaciones anidadas (p. ej.
 * `client.create({ data: { contacts: { create: [...] } } })`) NO reciben el
 * organizationId en los hijos. Para entidades hijas, créalas con su propia
 * operación (`createMany`) dentro de una transacción.
 */
export function getDb(organizationId: string) {
  return basePrisma.$extends({
    name: "tenant-isolation",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) {
            return query(args);
          }

          const next = { ...((args as Record<string, unknown>) ?? {}) };

          if (WHERE_OPS.has(operation)) {
            next.where = {
              ...((next.where as Record<string, unknown>) ?? {}),
              organizationId,
            };
          }

          if (operation === "create") {
            next.data = {
              ...((next.data as Record<string, unknown>) ?? {}),
              organizationId,
            };
          }

          if (operation === "createMany" || operation === "createManyAndReturn") {
            const data = next.data;
            next.data = Array.isArray(data)
              ? data.map((d) => ({ ...(d as object), organizationId }))
              : { ...((data as object) ?? {}), organizationId };
          }

          if (operation === "upsert") {
            next.create = {
              ...((next.create as Record<string, unknown>) ?? {}),
              organizationId,
            };
          }

          return query(next);
        },
      },
    },
  });
}

export type Db = ReturnType<typeof getDb>;
