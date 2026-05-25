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

// Llaves que indican una escritura anidada hacia otra entidad. Si aparecen en
// `data` o en `create`/`update` de un upsert, lanzamos: el extends no propaga
// organizationId a los hijos, así que el patrón seguro es transacción explícita
// con createMany por entidad hija (ver src/features/clients/actions.ts).
const NESTED_WRITE_KEYS = new Set([
  "create",
  "createMany",
  "connectOrCreate",
  "upsert",
]);

function assertNoNestedWrites(
  model: string,
  operation: string,
  data: unknown,
): void {
  if (!data || typeof data !== "object") return;
  for (const value of Object.values(data as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (NESTED_WRITE_KEYS.has(key)) {
        throw new Error(
          `[tenant-isolation] Escritura anidada (${key}) detectada en ` +
            `${model}.${operation}. El extends no propaga organizationId a los ` +
            `hijos. Usá $transaction + createMany por entidad. ` +
            `Si necesitás conectar (sin crear), usá { connect: { id } }.`,
        );
      }
    }
  }
}

/**
 * Devuelve un cliente Prisma extendido y atado a una organización.
 *
 * Garantía: toda lectura/escritura sobre un modelo de dominio queda acotada a
 * `organizationId`. Es imposible (sin SQL crudo) leer o mutar datos de otro
 * tenant a través de este cliente.
 *
 * Defensa adicional: si una operación de escritura sobre un modelo tenant
 * incluye nested writes (`create`, `createMany`, `connectOrCreate`, `upsert`
 * anidados), se lanza un error en runtime. El patrón seguro es transacción
 * explícita con createMany por entidad hija.
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
            assertNoNestedWrites(model, operation, next.data);
            next.data = {
              ...((next.data as Record<string, unknown>) ?? {}),
              organizationId,
            };
          }

          if (operation === "createMany" || operation === "createManyAndReturn") {
            const data = next.data;
            if (Array.isArray(data)) {
              for (const d of data) assertNoNestedWrites(model, operation, d);
            } else {
              assertNoNestedWrites(model, operation, data);
            }
            next.data = Array.isArray(data)
              ? data.map((d) => ({ ...(d as object), organizationId }))
              : { ...((data as object) ?? {}), organizationId };
          }

          if (operation === "update" || operation === "updateMany") {
            assertNoNestedWrites(model, operation, next.data);
          }

          if (operation === "upsert") {
            assertNoNestedWrites(model, operation, next.create);
            assertNoNestedWrites(model, operation, next.update);
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
