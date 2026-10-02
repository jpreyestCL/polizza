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
ALTER TABLE "Installment" ADD COLUMN "voidedByTermination" BOOLEAN NOT NULL DEFAULT false;
