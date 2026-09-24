-- CreateEnum
CREATE TYPE "ProposalKind" AS ENUM ('POLIZA', 'ENDOSO');

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "dispatchedAt" TIMESTAMP(3),
ADD COLUMN     "endorsedPolicyId" TEXT,
ADD COLUMN     "endorsementDetail" TEXT,
ADD COLUMN     "endorsementType" "EndorsementType",
ADD COLUMN     "kind" "ProposalKind" NOT NULL DEFAULT 'POLIZA';

-- AlterTable
ALTER TABLE "Endorsement" ADD COLUMN     "detail" TEXT,
ADD COLUMN     "endDate" DATE,
ADD COLUMN     "endorsementNumber" TEXT,
ADD COLUMN     "proposalId" TEXT;

-- AlterTable
ALTER TABLE "CompanyCommissionPayment" ADD COLUMN     "invoiceDate" DATE;

-- CreateIndex
CREATE INDEX "Proposal_endorsedPolicyId_idx" ON "Proposal"("endorsedPolicyId");

-- CreateIndex
CREATE UNIQUE INDEX "Endorsement_proposalId_key" ON "Endorsement"("proposalId");

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

