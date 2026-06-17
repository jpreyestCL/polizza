-- AlterTable
ALTER TABLE "Policy" ADD COLUMN     "commissionAmount" DECIMAL(14,2),
ADD COLUMN     "commissionPercent" DECIMAL(7,4),
ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Policy_organizationId_externalId_key" ON "Policy"("organizationId", "externalId");

