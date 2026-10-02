-- El ciclo del siniestro pasa a los estados de la especificación.
-- El resultado de cierre se copia antes de reescribir el estado viejo.

ALTER TABLE "Claim" ADD COLUMN "substatusCode" TEXT;
ALTER TABLE "Claim" ADD COLUMN "closureOutcome" TEXT;
ALTER TABLE "Claim" ADD COLUMN "adjustmentLegalDeadline" DATE;
ALTER TABLE "Claim" ADD COLUMN "closeDeadline" DATE;
ALTER TABLE "Claim" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "Claim" ADD COLUMN "closedOnTime" BOOLEAN;
ALTER TABLE "Claim" ADD COLUMN "reopenCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Claim" ADD COLUMN "finalReportReceivedAt" DATE;
ALTER TABLE "Claim" ADD COLUMN "disputeDeadline" DATE;
ALTER TABLE "Claim" ADD COLUMN "isDisputed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Claim" ADD COLUMN "isPreventive" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Claim"
SET "closureOutcome" = CASE "status"
  WHEN 'PAGADO' THEN 'PAID'
  WHEN 'RECHAZADO' THEN 'REJECTED'
  ELSE "closureOutcome"
END;

UPDATE "Claim"
SET "substatusCode" = CASE "status"
  WHEN 'REPORTADO' THEN 'REPORT_PENDING_SEND'
  WHEN 'INGRESADO_COMPANIA' THEN 'AWAITING_INSURER_ASSIGNMENT'
  WHEN 'EN_EVALUACION' THEN 'REPORTED_AND_ASSIGNED'
  WHEN 'APROBADO' THEN 'AWAITING_INSURER_PAYMENT'
  WHEN 'RECHAZADO' THEN 'CLOSED'
  WHEN 'PAGADO' THEN 'CLOSED'
  WHEN 'CERRADO' THEN 'CLOSED'
  ELSE "substatusCode"
END;

ALTER TABLE "Claim" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Claim" ALTER COLUMN "status" TYPE TEXT;
ALTER TABLE "ClaimStatusHistory" ALTER COLUMN "status" TYPE TEXT;

UPDATE "Claim"
SET "status" = CASE "status"
  WHEN 'REPORTADO' THEN 'REPORTED'
  WHEN 'INGRESADO_COMPANIA' THEN 'AWAITING_ASSIGNMENT'
  WHEN 'EN_EVALUACION' THEN 'IN_ADJUSTMENT'
  WHEN 'APROBADO' THEN 'PAYMENT_PROCESS'
  WHEN 'RECHAZADO' THEN 'CLOSED'
  WHEN 'PAGADO' THEN 'CLOSED'
  WHEN 'CERRADO' THEN 'CLOSED'
  ELSE "status"
END;

UPDATE "ClaimStatusHistory"
SET "status" = CASE "status"
  WHEN 'REPORTADO' THEN 'REPORTED'
  WHEN 'INGRESADO_COMPANIA' THEN 'AWAITING_ASSIGNMENT'
  WHEN 'EN_EVALUACION' THEN 'IN_ADJUSTMENT'
  WHEN 'APROBADO' THEN 'PAYMENT_PROCESS'
  WHEN 'RECHAZADO' THEN 'CLOSED'
  WHEN 'PAGADO' THEN 'CLOSED'
  WHEN 'CERRADO' THEN 'CLOSED'
  ELSE "status"
END;

UPDATE "Claim"
SET "status" = 'VOID'
WHERE "voidedAt" IS NOT NULL;

DROP TYPE "ClaimStatus";
CREATE TYPE "ClaimStatus" AS ENUM (
  'REPORTED',
  'AWAITING_ASSIGNMENT',
  'IN_ADJUSTMENT',
  'PAYMENT_PROCESS',
  'CLOSED',
  'VOID'
);

ALTER TABLE "Claim"
  ALTER COLUMN "status" TYPE "ClaimStatus" USING "status"::"ClaimStatus",
  ALTER COLUMN "status" SET DEFAULT 'REPORTED';

ALTER TABLE "ClaimStatusHistory"
  ALTER COLUMN "status" TYPE "ClaimStatus" USING "status"::"ClaimStatus";

CREATE TABLE "ClaimAdjustmentExtension" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "requestedOn" DATE NOT NULL,
  "previousDeadline" DATE NOT NULL,
  "newDeadline" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClaimAdjustmentExtension_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClaimAdjustmentExtension_organizationId_idx" ON "ClaimAdjustmentExtension"("organizationId");
CREATE INDEX "ClaimAdjustmentExtension_claimId_idx" ON "ClaimAdjustmentExtension"("claimId");

ALTER TABLE "ClaimAdjustmentExtension"
  ADD CONSTRAINT "ClaimAdjustmentExtension_claimId_fkey"
  FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
