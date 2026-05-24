
-- CreateEnum
CREATE TYPE "ClaimEntryParty" AS ENUM ('COMPANIA', 'CORREDOR');

-- CreateEnum
CREATE TYPE "ClaimEntryChannel" AS ENUM ('TELEFONO', 'EMAIL', 'WEB', 'CALL_CENTER', 'OTRO');

-- CreateEnum
CREATE TYPE "ClaimLossType" AS ENUM ('PARCIAL', 'TOTAL');

-- CreateEnum
CREATE TYPE "ClaimLogKind" AS ENUM ('CREATED', 'STATUS_CHANGED', 'COMPANY_FILED', 'COMPANY_NUMBER_ASSIGNED', 'LIQUIDATOR_ASSIGNED', 'DOCUMENT_UPLOADED', 'THIRD_PARTY_ADDED', 'THIRD_PARTY_REMOVED', 'UPDATED', 'NOTE');

-- AlterEnum
ALTER TYPE "ClaimStatus" ADD VALUE 'INGRESADO_COMPANIA';

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "branchTypeId" TEXT,
ADD COLUMN     "companyClaimNumber" TEXT,
ADD COLUMN     "data" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "driverAge" INTEGER,
ADD COLUMN     "driverAtFault" BOOLEAN,
ADD COLUMN     "driverFirstName" TEXT,
ADD COLUMN     "driverLastName" TEXT,
ADD COLUMN     "driverRut" TEXT,
ADD COLUMN     "entryChannel" "ClaimEntryChannel",
ADD COLUMN     "entryParty" "ClaimEntryParty",
ADD COLUMN     "filedAtCompanyAt" TIMESTAMP(3),
ADD COLUMN     "folderNumber" INTEGER,
ADD COLUMN     "hasAlcoholTest" BOOLEAN,
ADD COLUMN     "incidentAddress" TEXT,
ADD COLUMN     "incidentCause" TEXT,
ADD COLUMN     "incidentCity" TEXT,
ADD COLUMN     "incidentCommune" TEXT,
ADD COLUMN     "incidentNarrative" TEXT,
ADD COLUMN     "liquidatorName" TEXT,
ADD COLUMN     "lossType" "ClaimLossType",
ADD COLUMN     "mainCoverageAffected" TEXT,
ADD COLUMN     "occurredAtTime" TEXT,
ADD COLUMN     "policeReportDate" DATE,
ADD COLUMN     "policeReportFolio" TEXT,
ADD COLUMN     "policeStation" TEXT,
ADD COLUMN     "policyItemId" TEXT,
ADD COLUMN     "proposalItemId" TEXT,
ADD COLUMN     "reportedAtBroker" TIMESTAMP(3),
ADD COLUMN     "reporterEmail" TEXT,
ADD COLUMN     "reporterFirstName" TEXT,
ADD COLUMN     "reporterLastName" TEXT,
ADD COLUMN     "reporterPhone" TEXT,
ADD COLUMN     "reporterRut" TEXT,
ADD COLUMN     "smartDeductible" BOOLEAN;

-- Backfill folderNumber con un correlativo por organización
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "createdAt") AS rn
  FROM "Claim"
)
UPDATE "Claim" SET "folderNumber" = numbered.rn
FROM numbered
WHERE "Claim".id = numbered.id;

ALTER TABLE "Claim" ALTER COLUMN "folderNumber" SET NOT NULL;

-- CreateTable
CREATE TABLE "ClaimThirdParty" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "involvesVehicle" BOOLEAN NOT NULL DEFAULT true,
    "firstName" TEXT,
    "lastName" TEXT,
    "rut" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "vehicleType" TEXT,
    "vehicleBrand" TEXT,
    "vehicleModel" TEXT,
    "vehicleYear" INTEGER,
    "plate" TEXT,
    "engineNumber" TEXT,
    "chassisNumber" TEXT,
    "hasInsurance" BOOLEAN,
    "insuranceCompany" TEXT,
    "policyNumber" TEXT,
    "atFault" BOOLEAN,
    "damagedGoodsDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimThirdParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "kind" "ClaimLogKind" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClaimThirdParty_organizationId_idx" ON "ClaimThirdParty"("organizationId");

-- CreateIndex
CREATE INDEX "ClaimThirdParty_claimId_idx" ON "ClaimThirdParty"("claimId");

-- CreateIndex
CREATE INDEX "ClaimLog_organizationId_idx" ON "ClaimLog"("organizationId");

-- CreateIndex
CREATE INDEX "ClaimLog_claimId_idx" ON "ClaimLog"("claimId");

-- CreateIndex
CREATE INDEX "Claim_policyId_idx" ON "Claim"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_organizationId_folderNumber_key" ON "Claim"("organizationId", "folderNumber");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_policyItemId_fkey" FOREIGN KEY ("policyItemId") REFERENCES "PolicyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_proposalItemId_fkey" FOREIGN KEY ("proposalItemId") REFERENCES "ProposalItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_branchTypeId_fkey" FOREIGN KEY ("branchTypeId") REFERENCES "BranchType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimThirdParty" ADD CONSTRAINT "ClaimThirdParty_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimLog" ADD CONSTRAINT "ClaimLog_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

