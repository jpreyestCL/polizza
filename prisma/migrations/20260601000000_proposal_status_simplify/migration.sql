-- Simplificación del flujo de estados de propuesta (obs 10-12):
--   * "Por enviar"  -> rotulado "Por enviar a la cía"  (solo label en UI)
--   * "Devuelta"    -> rotulado "Devuelta a la cía"     (solo label en UI)
--   * Se eliminan los estados EMITIDA, DESPACHADA y RECHAZADA del enum.
--
-- Remapeo de datos existentes (decidido con el cliente):
--   EMITIDA / DESPACHADA -> POR_DESPACHAR
--   RECHAZADA            -> DEVUELTA

-- 0) Backfill de pólizas para propuestas DESPACHADA legacy (review #1).
--    El flujo anterior dejaba la propuesta en DESPACHADA SIN crear una Policy.
--    Como ahora "tiene póliza vinculada" es la señal de que la propuesta vive
--    en la cartera, sin este backfill esas propuestas reaparecerían como
--    "Por despachar". Creamos la Policy mínima (sin ítems/coberturas) para que
--    queden en la cartera y desaparezcan del flujo de propuestas.
INSERT INTO "Policy" (
  "id", "organizationId", "clientId", "proposalId", "policyNumber",
  "companyId", "lineId", "branchId", "status", "premiumNet", "currency",
  "startDate", "endDate", "assignedUserId", "createdById", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  p."organizationId",
  p."clientId",
  p."id",
  COALESCE(NULLIF(TRIM(p."policyNumberGenerated"), ''), p."proposalNumber"),
  p."companyId",
  p."lineId",
  p."branchId",
  'VIGENTE',
  p."premiumNet",
  p."currency",
  p."startDate",
  p."endDate",
  p."assignedUserId",
  p."createdById",
  now(),
  now()
FROM "Proposal" p
WHERE p."status" = 'DESPACHADA'
  AND NOT EXISTS (
    SELECT 1 FROM "Policy" pol WHERE pol."proposalId" = p."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "Policy" pol2
    WHERE pol2."organizationId" = p."organizationId"
      AND pol2."policyNumber" =
        COALESCE(NULLIF(TRIM(p."policyNumberGenerated"), ''), p."proposalNumber")
  );

-- 1) Remapear datos antes de alterar el tipo enum.
UPDATE "Proposal" SET "status" = 'POR_DESPACHAR'
  WHERE "status" IN ('EMITIDA', 'DESPACHADA');
UPDATE "Proposal" SET "status" = 'DEVUELTA'
  WHERE "status" = 'RECHAZADA';

UPDATE "ProposalStatusHistory" SET "status" = 'POR_DESPACHAR'
  WHERE "status" IN ('EMITIDA', 'DESPACHADA');
UPDATE "ProposalStatusHistory" SET "status" = 'DEVUELTA'
  WHERE "status" = 'RECHAZADA';

-- 2) Recrear el enum sin los valores eliminados.
ALTER TYPE "ProposalStatus" RENAME TO "ProposalStatus_old";

CREATE TYPE "ProposalStatus" AS ENUM (
  'ELABORACION',
  'POR_ENVIAR',
  'ENVIADA_COMPANIA',
  'DEVUELTA',
  'POR_DESPACHAR'
);

ALTER TABLE "Proposal" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Proposal"
  ALTER COLUMN "status" TYPE "ProposalStatus"
  USING ("status"::text::"ProposalStatus");
ALTER TABLE "ProposalStatusHistory"
  ALTER COLUMN "status" TYPE "ProposalStatus"
  USING ("status"::text::"ProposalStatus");
ALTER TABLE "Proposal" ALTER COLUMN "status" SET DEFAULT 'ELABORACION';

DROP TYPE "ProposalStatus_old";
