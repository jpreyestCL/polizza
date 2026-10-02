-- AlterEnum
ALTER TYPE "EndorsementType" ADD VALUE 'REVERSO_PRORROGA';
ALTER TYPE "EndorsementType" ADD VALUE 'REDUCE_VIGENCIA';
ALTER TYPE "EndorsementType" ADD VALUE 'CAMBIO_COMISION';
ALTER TYPE "EndorsementType" ADD VALUE 'DECLARACION';
ALTER TYPE "EndorsementType" ADD VALUE 'AJUSTE_PRIMA';

-- AlterEnum
ALTER TYPE "PolicyStatus" ADD VALUE 'BORRADOR';
ALTER TYPE "PolicyStatus" ADD VALUE 'ENVIADA';
ALTER TYPE "PolicyStatus" ADD VALUE 'POR_DESPACHAR';
ALTER TYPE "PolicyStatus" ADD VALUE 'RECHAZADA';
ALTER TYPE "PolicyStatus" ADD VALUE 'DESCARTADA';

-- AlterTable
ALTER TABLE "Endorsement" ADD COLUMN     "commissionAffectPct" DECIMAL(6,3),
ADD COLUMN     "commissionExemptPct" DECIMAL(6,3),
ADD COLUMN     "newInsuredAmount" DECIMAL(16,2),
ADD COLUMN     "offsetClaimId" TEXT;

-- AlterTable
ALTER TABLE "Policy" ADD COLUMN     "lineageId" TEXT,
ADD COLUMN     "termNumber" INTEGER NOT NULL DEFAULT 1;

UPDATE "Policy" SET "lineageId" = id WHERE "lineageId" IS NULL;

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "endorsementCommissionAffectPct" DECIMAL(6,3),
ADD COLUMN     "endorsementCommissionExemptPct" DECIMAL(6,3),
ADD COLUMN     "endorsementNewInsuredAmount" DECIMAL(16,2),
ADD COLUMN     "endorsementOffsetClaimId" TEXT;

-- CreateIndex
CREATE INDEX "Policy_organizationId_lineageId_idx" ON "Policy"("organizationId", "lineageId");

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
