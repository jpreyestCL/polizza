-- Modelo de la especificación que el flujo Propuesta + Póliza no tenía:
-- envío inmutable, comparación de emisión, liquidación N:M, parámetros
-- de la corredora y deducible estructurado.
-- RLS queda habilitado sin FORCE: si no hay corredora en la sesión, la
-- política deja pasar. El rol dueño y el superusuario siguen leyendo.

ALTER TABLE "ProposalItemCoverage" ADD COLUMN "deductibleText" TEXT;
ALTER TABLE "ProposalItemCoverage" ADD COLUMN "deductibleAmount" DECIMAL(18,4);
ALTER TABLE "ProposalItemCoverage" ADD COLUMN "deductiblePct" DECIMAL(8,4);
ALTER TABLE "ProposalItemCoverage" ADD COLUMN "deductibleMinimum" DECIMAL(18,4);

ALTER TABLE "PolicyCoverage" ADD COLUMN "deductibleAmount" DECIMAL(18,4);
ALTER TABLE "PolicyCoverage" ADD COLUMN "deductiblePct" DECIMAL(8,4);
ALTER TABLE "PolicyCoverage" ADD COLUMN "deductibleMinimum" DECIMAL(18,4);

CREATE TABLE "PolicySubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "seqNo" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicySubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiComparison" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "proposalId" TEXT,
    "policyId" TEXT,
    "verdict" TEXT NOT NULL,
    "blocksIssuance" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiComparison_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiDiscrepancy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "expectedValue" TEXT,
    "actualValue" TEXT,
    CONSTRAINT "AiDiscrepancy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionStatement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "insurerName" TEXT,
    "periodFrom" DATE,
    "periodTo" DATE,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionStatement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionStatementLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "policyNumber" TEXT,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    CONSTRAINT "CommissionStatementLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionAllocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationSettings" (
    "organizationId" TEXT NOT NULL,
    "presumedPaidEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaRequired" BOOLEAN NOT NULL DEFAULT false,
    "ssoEnabled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("organizationId")
);

CREATE UNIQUE INDEX "PolicySubmission_proposalId_seqNo_key" ON "PolicySubmission"("proposalId", "seqNo");
CREATE INDEX "PolicySubmission_organizationId_idx" ON "PolicySubmission"("organizationId");
CREATE INDEX "PolicySubmission_proposalId_idx" ON "PolicySubmission"("proposalId");

CREATE INDEX "AiComparison_organizationId_idx" ON "AiComparison"("organizationId");
CREATE INDEX "AiComparison_proposalId_idx" ON "AiComparison"("proposalId");
CREATE INDEX "AiComparison_policyId_idx" ON "AiComparison"("policyId");

CREATE INDEX "AiDiscrepancy_organizationId_idx" ON "AiDiscrepancy"("organizationId");
CREATE INDEX "AiDiscrepancy_comparisonId_idx" ON "AiDiscrepancy"("comparisonId");

CREATE INDEX "CommissionStatement_organizationId_idx" ON "CommissionStatement"("organizationId");
CREATE INDEX "CommissionStatementLine_organizationId_idx" ON "CommissionStatementLine"("organizationId");
CREATE INDEX "CommissionStatementLine_statementId_idx" ON "CommissionStatementLine"("statementId");
CREATE INDEX "CommissionAllocation_organizationId_idx" ON "CommissionAllocation"("organizationId");
CREATE INDEX "CommissionAllocation_lineId_idx" ON "CommissionAllocation"("lineId");
CREATE INDEX "CommissionAllocation_receivableId_idx" ON "CommissionAllocation"("receivableId");

ALTER TABLE "PolicySubmission" ADD CONSTRAINT "PolicySubmission_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiComparison" ADD CONSTRAINT "AiComparison_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiComparison" ADD CONSTRAINT "AiComparison_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiDiscrepancy" ADD CONSTRAINT "AiDiscrepancy_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "AiComparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionStatementLine" ADD CONSTRAINT "CommissionStatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CommissionStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionAllocation" ADD CONSTRAINT "CommissionAllocation_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "CommissionStatementLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionAllocation" ADD CONSTRAINT "CommissionAllocation_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "CommissionReceivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Habilita RLS sin forzar. current_setting(..., true) es NULL si nadie
-- fijó la corredora: en ese caso la fila se ve, igual que hoy. Con la
-- variable puesta, solo pasa la corredora de la sesión.
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
