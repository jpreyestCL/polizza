-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('REPORTADO', 'EN_EVALUACION', 'APROBADO', 'RECHAZADO', 'PAGADO', 'CERRADO');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDIENTE', 'PAGADA', 'ANULADA');

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "policyId" TEXT,
    "claimNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" DATE,
    "reportedAt" DATE,
    "status" "ClaimStatus" NOT NULL DEFAULT 'REPORTADO',
    "estimatedAmount" DECIMAL(14,2),
    "settledAmount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'UF',
    "assignedUserId" TEXT,
    "createdById" TEXT,
    "currentStateStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimStatusHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL,
    "note" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UF',
    "dueDate" DATE NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "paidAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Claim_organizationId_idx" ON "Claim"("organizationId");

-- CreateIndex
CREATE INDEX "Claim_clientId_idx" ON "Claim"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_organizationId_claimNumber_key" ON "Claim"("organizationId", "claimNumber");

-- CreateIndex
CREATE INDEX "ClaimStatusHistory_organizationId_idx" ON "ClaimStatusHistory"("organizationId");

-- CreateIndex
CREATE INDEX "ClaimStatusHistory_claimId_idx" ON "ClaimStatusHistory"("claimId");

-- CreateIndex
CREATE INDEX "Installment_organizationId_idx" ON "Installment"("organizationId");

-- CreateIndex
CREATE INDEX "Installment_policyId_idx" ON "Installment"("policyId");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimStatusHistory" ADD CONSTRAINT "ClaimStatusHistory_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
