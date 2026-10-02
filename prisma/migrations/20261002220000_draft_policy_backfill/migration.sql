-- AlterTable
ALTER TABLE "Endorsement" ADD COLUMN "priorSnapshot" JSONB;

-- Una propuesta de póliza que ya estaba abierta recibe su fila.
WITH missing AS (
  SELECT p.*
  FROM "Proposal" p
  WHERE p.kind = 'POLIZA'
    AND NOT EXISTS (
      SELECT 1 FROM "Policy" pol WHERE pol."proposalId" = p.id
    )
),
numbered AS (
  SELECT
    m.*,
    ('p' || m.id) AS new_id,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM "Policy" pol
        WHERE pol."organizationId" = m."organizationId"
          AND pol."policyNumber" = COALESCE(NULLIF(BTRIM(m."policyNumberGenerated"), ''), m."proposalNumber")
      )
      THEN m."proposalNumber" || '-' || RIGHT(m.id, 6)
      ELSE COALESCE(NULLIF(BTRIM(m."policyNumberGenerated"), ''), m."proposalNumber")
    END AS new_number,
    CASE
      WHEN m."dispatchedAt" IS NOT NULL THEN 'VIGENTE'::"PolicyStatus"
      WHEN m.status::text = 'ENVIADA_COMPANIA' THEN 'ENVIADA'::"PolicyStatus"
      WHEN m.status::text = 'POR_DESPACHAR' THEN 'POR_DESPACHAR'::"PolicyStatus"
      WHEN m.status::text = 'RECHAZADA' THEN 'RECHAZADA'::"PolicyStatus"
      WHEN m.status::text = 'DESCARTADA' THEN 'DESCARTADA'::"PolicyStatus"
      ELSE 'BORRADOR'::"PolicyStatus"
    END AS new_status
  FROM missing m
),
inserted AS (
  INSERT INTO "Policy" (
    "id",
    "organizationId",
    "clientId",
    "proposalId",
    "policyNumber",
    "status",
    "premiumNet",
    "currency",
    "startDate",
    "endDate",
    "companyId",
    "lineId",
    "branchId",
    "productId",
    "assignedUserId",
    "salespersonId",
    "previousPolicyId",
    "commissionAffectPct",
    "commissionExemptPct",
    "lineageId",
    "termNumber",
    "createdById",
    "createdAt",
    "updatedAt"
  )
  SELECT
    n.new_id,
    n."organizationId",
    n."clientId",
    n.id,
    n.new_number,
    n.new_status,
    n."premiumNet",
    n.currency,
    n."startDate",
    n."endDate",
    n."companyId",
    n."lineId",
    n."branchId",
    n."productId",
    n."assignedUserId",
    n."salespersonId",
    n."previousPolicyId",
    n."commissionAffectPct",
    n."commissionExemptPct",
    COALESCE(mother."lineageId", mother.id, n.new_id),
    CASE
      WHEN mother.id IS NULL THEN 1
      ELSE COALESCE(mother."termNumber", 1) + 1
    END,
    n."createdById",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM numbered n
  LEFT JOIN "Policy" mother ON mother.id = n."previousPolicyId"
  RETURNING "id", "organizationId", "status", "createdById"
)
INSERT INTO "PolicyStatusHistory" (
  "id",
  "organizationId",
  "policyId",
  "status",
  "note",
  "changedById"
)
SELECT
  'h' || inserted.id,
  inserted."organizationId",
  inserted.id,
  inserted.status,
  'Póliza abierta con la propuesta que ya existía',
  inserted."createdById"
FROM inserted;
