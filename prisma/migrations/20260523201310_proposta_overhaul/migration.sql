-- AlterTable
ALTER TABLE "InsuranceCompanyContact" ADD COLUMN     "isReservationRecipient" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "proposalNumberPattern" TEXT NOT NULL DEFAULT '{YEAR}-{SEQ:0000}',
ADD COLUMN     "proposalSequenceValue" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "proposalSequenceYear" INTEGER,
ADD COLUMN     "reservaDays" INTEGER NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "garantiaCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "garantiaCompletedAt" DATE,
ADD COLUMN     "garantiaExpiry" DATE,
ADD COLUMN     "garantiaObservations" TEXT,
ADD COLUMN     "isRenewal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "previousPolicyNumberText" TEXT,
ADD COLUMN     "salespersonId" TEXT;

-- CreateTable
CREATE TABLE "Broker" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rut" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "contactName" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalBrokerParticipation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "participationPct" DECIMAL(6,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalBrokerParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalCoaseguroParticipation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "insuranceCompanyId" TEXT NOT NULL,
    "participationPct" DECIMAL(6,3) NOT NULL,
    "policyNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalCoaseguroParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Broker_organizationId_idx" ON "Broker"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Broker_organizationId_rut_key" ON "Broker"("organizationId", "rut");

-- CreateIndex
CREATE INDEX "ProposalBrokerParticipation_organizationId_idx" ON "ProposalBrokerParticipation"("organizationId");

-- CreateIndex
CREATE INDEX "ProposalBrokerParticipation_proposalId_idx" ON "ProposalBrokerParticipation"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalBrokerParticipation_brokerId_idx" ON "ProposalBrokerParticipation"("brokerId");

-- CreateIndex
CREATE INDEX "ProposalCoaseguroParticipation_organizationId_idx" ON "ProposalCoaseguroParticipation"("organizationId");

-- CreateIndex
CREATE INDEX "ProposalCoaseguroParticipation_proposalId_idx" ON "ProposalCoaseguroParticipation"("proposalId");

-- AddForeignKey
ALTER TABLE "ProposalBrokerParticipation" ADD CONSTRAINT "ProposalBrokerParticipation_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalBrokerParticipation" ADD CONSTRAINT "ProposalBrokerParticipation_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalCoaseguroParticipation" ADD CONSTRAINT "ProposalCoaseguroParticipation_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
