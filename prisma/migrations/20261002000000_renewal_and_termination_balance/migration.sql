-- AlterTable
ALTER TABLE "InsuranceProduct" ADD COLUMN "isRenewable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "PaymentPlan" ADD COLUMN "terminationBalance" DECIMAL(18,4),
ADD COLUMN "terminationBalanceIsEstimate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "closedReason" TEXT;

-- AlterTable
ALTER TABLE "Policy" ADD COLUMN "notRenewable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "nonRenewalReason" TEXT,
ADD COLUMN "nonRenewalNote" TEXT,
ADD COLUMN "nonRenewalAt" TIMESTAMP(3),
ADD COLUMN "terminationBalance" DECIMAL(18,4),
ADD COLUMN "terminationBalanceIsEstimate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "terminationReason" TEXT;

-- AlterTable
ALTER TABLE "Installment" ADD COLUMN "voidedByTermination" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "amountPaid" DECIMAL(14,2),
ADD COLUMN "statusBeforeTermination" "InstallmentStatus";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "marketingConsentAt" TIMESTAMP(3),
ADD COLUMN "aiProcessingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "aiProcessingConsentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN "endorsementPremiumAffected" DECIMAL(18,4),
ADD COLUMN "endorsementPremiumExempt" DECIMAL(18,4);

-- AlterTable
ALTER TABLE "Endorsement" ADD COLUMN "premiumAffectedDelta" DECIMAL(18,4),
ADD COLUMN "premiumExemptDelta" DECIMAL(18,4);

-- AlterTable
ALTER TABLE "Policy" ADD COLUMN "issueProblemCode" TEXT,
ADD COLUMN "issueProblemDetail" TEXT,
ADD COLUMN "issueProblemOpenedAt" TIMESTAMP(3);

-- AlterEnum
ALTER TYPE "InstallmentStatus" ADD VALUE IF NOT EXISTS 'PARCIAL';
ALTER TYPE "InstallmentStatus" ADD VALUE IF NOT EXISTS 'PRESUNTA';
ALTER TYPE "InstallmentStatus" ADD VALUE IF NOT EXISTS 'RECHAZADA';
ALTER TYPE "InstallmentStatus" ADD VALUE IF NOT EXISTS 'CASTIGADA';

-- CreateEnum
CREATE TYPE "PremiumMovementType" AS ENUM ('ISSUE', 'ENDORSEMENT', 'REVERSAL');
CREATE TYPE "CommissionReceivableStatus" AS ENUM ('PENDING', 'VOID', 'SETTLED');

-- CreateTable
CREATE TABLE "PremiumMovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "endorsementId" TEXT,
    "seqNo" INTEGER NOT NULL,
    "movementType" "PremiumMovementType" NOT NULL,
    "issuedOn" DATE NOT NULL,
    "effectiveOn" DATE NOT NULL,
    "premiumAffected" DECIMAL(18,4) NOT NULL,
    "premiumExempt" DECIMAL(18,4) NOT NULL,
    "taxAmount" DECIMAL(18,4) NOT NULL,
    "premiumNet" DECIMAL(18,4) NOT NULL,
    "premiumGross" DECIMAL(18,4) NOT NULL,
    "commissionAffected" DECIMAL(18,4) NOT NULL,
    "commissionExempt" DECIMAL(18,4) NOT NULL,
    "commissionTotal" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UF',
    "reversesMovementId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PremiumMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionReceivable" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UF',
    "status" "CommissionReceivableStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PremiumMovement_policyId_seqNo_key" ON "PremiumMovement"("policyId", "seqNo");
CREATE UNIQUE INDEX "PremiumMovement_reversesMovementId_key" ON "PremiumMovement"("reversesMovementId");
CREATE INDEX "PremiumMovement_organizationId_idx" ON "PremiumMovement"("organizationId");
CREATE INDEX "PremiumMovement_policyId_idx" ON "PremiumMovement"("policyId");
CREATE INDEX "PremiumMovement_endorsementId_idx" ON "PremiumMovement"("endorsementId");
CREATE UNIQUE INDEX "CommissionReceivable_movementId_key" ON "CommissionReceivable"("movementId");
CREATE INDEX "CommissionReceivable_organizationId_idx" ON "CommissionReceivable"("organizationId");
CREATE INDEX "CommissionReceivable_policyId_idx" ON "CommissionReceivable"("policyId");

-- AddForeignKey
ALTER TABLE "PremiumMovement" ADD CONSTRAINT "PremiumMovement_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionReceivable" ADD CONSTRAINT "CommissionReceivable_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionReceivable" ADD CONSTRAINT "CommissionReceivable_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "PremiumMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
