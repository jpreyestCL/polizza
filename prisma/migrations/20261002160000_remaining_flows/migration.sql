-- DESCARTADA y CREDITED no se escriben en este archivo.
-- Postgres 16 permite agregar el valor en la misma transacción.

ALTER TYPE "ProposalStatus" ADD VALUE 'DESCARTADA';
ALTER TYPE "InstallmentStatus" ADD VALUE 'CREDITED';

ALTER TABLE "Proposal" ADD COLUMN "discardedAt" TIMESTAMP(3);
ALTER TABLE "Proposal" ADD COLUMN "discardedReason" TEXT;

ALTER TABLE "Endorsement" ADD COLUMN "specType" TEXT;
ALTER TABLE "Endorsement" ADD COLUMN "calcMethod" TEXT;
ALTER TABLE "Endorsement" ADD COLUMN "initiatedBy" TEXT;
ALTER TABLE "Endorsement" ADD COLUMN "inalterabilityNote" TEXT;

ALTER TABLE "Policy" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Policy" ADD COLUMN "reopenedIssueAt" TIMESTAMP(3);
ALTER TABLE "Policy" ADD COLUMN "reopenedIssueReason" TEXT;

ALTER TABLE "Claim" ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "Claim" ADD COLUMN "voidReason" TEXT;
ALTER TABLE "Claim" ADD COLUMN "reopenedAt" TIMESTAMP(3);

ALTER TABLE "Installment" ADD COLUMN "creditedAmount" DECIMAL(18,4);

CREATE TYPE "AiExtractionStatus" AS ENUM (
  'QUEUED',
  'EXTRACTED',
  'NEEDS_REVIEW',
  'ACCEPTED',
  'REJECTED'
);

CREATE TABLE "AiExtraction" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceKind" TEXT NOT NULL,
  "sourceText" TEXT NOT NULL,
  "status" "AiExtractionStatus" NOT NULL DEFAULT 'QUEUED',
  "policyNumber" TEXT,
  "premiumNet" DECIMAL(18,4),
  "startDate" TEXT,
  "endDate" TEXT,
  "evidence" JSONB,
  "reviewNote" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiExtraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "profile" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREVIEW',
  "fileName" TEXT,
  "decisionNote" TEXT,
  "choice" TEXT,
  "createdById" TEXT,
  "appliedAt" TIMESTAMP(3),
  "revertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportJobRow" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "rowNo" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdEntityType" TEXT,
  "createdEntityId" TEXT,
  "message" TEXT,
  CONSTRAINT "ImportJobRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantFeature" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "TenantFeature_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdempotencyRecord" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "command" TEXT NOT NULL,
  "resultJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MfaEnrollment" (
  "userId" TEXT NOT NULL,
  "secretBase32" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MfaEnrollment_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "AiExtraction_organizationId_idx" ON "AiExtraction"("organizationId");
CREATE INDEX "ImportJob_organizationId_idx" ON "ImportJob"("organizationId");
CREATE INDEX "ImportJobRow_organizationId_idx" ON "ImportJobRow"("organizationId");
CREATE INDEX "ImportJobRow_jobId_idx" ON "ImportJobRow"("jobId");
CREATE UNIQUE INDEX "TenantFeature_organizationId_code_key" ON "TenantFeature"("organizationId", "code");
CREATE INDEX "TenantFeature_organizationId_idx" ON "TenantFeature"("organizationId");
CREATE UNIQUE INDEX "IdempotencyRecord_organizationId_key_key" ON "IdempotencyRecord"("organizationId", "key");
CREATE INDEX "IdempotencyRecord_organizationId_idx" ON "IdempotencyRecord"("organizationId");

ALTER TABLE "ImportJobRow" ADD CONSTRAINT "ImportJobRow_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Vuelve a habilitar RLS, sin forzar, también en las tablas nuevas.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'organizationId'
      AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', r.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (current_setting(''app.organization_id'', true) IS NULL OR current_setting(''app.organization_id'', true) = '''' OR "organizationId" = current_setting(''app.organization_id'', true)) WITH CHECK (current_setting(''app.organization_id'', true) IS NULL OR current_setting(''app.organization_id'', true) = '''' OR "organizationId" = current_setting(''app.organization_id'', true))',
      r.table_name
    );
  END LOOP;
END $$;
