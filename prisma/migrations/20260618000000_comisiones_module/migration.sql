-- CreateEnum
CREATE TYPE "SellerSettlementStatus" AS ENUM ('PENDIENTE', 'PAGADA');

-- AlterTable
ALTER TABLE "Policy" ADD COLUMN     "salesCommissionPct" DECIMAL(6,3),
ADD COLUMN     "salespersonId" TEXT;

-- CreateTable
CREATE TABLE "SalespersonCommissionRate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultPct" DECIMAL(6,3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalespersonCommissionRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyCommissionPayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "invoiceNumber" TEXT,
    "exchangeFactor" DECIMAL(14,4),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyCommissionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerCommissionSettlement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "SellerSettlementStatus" NOT NULL DEFAULT 'PENDIENTE',
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerCommissionSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerCommissionSettlementItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "baseCommissionAmount" DECIMAL(14,2) NOT NULL,
    "appliedPct" DECIMAL(6,3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerCommissionSettlementItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalespersonCommissionRate_organizationId_idx" ON "SalespersonCommissionRate"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SalespersonCommissionRate_organizationId_userId_key" ON "SalespersonCommissionRate"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "CompanyCommissionPayment_organizationId_idx" ON "CompanyCommissionPayment"("organizationId");

-- CreateIndex
CREATE INDEX "CompanyCommissionPayment_policyId_idx" ON "CompanyCommissionPayment"("policyId");

-- CreateIndex
CREATE INDEX "SellerCommissionSettlement_organizationId_idx" ON "SellerCommissionSettlement"("organizationId");

-- CreateIndex
CREATE INDEX "SellerCommissionSettlement_organizationId_salespersonId_idx" ON "SellerCommissionSettlement"("organizationId", "salespersonId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerCommissionSettlement_organizationId_number_key" ON "SellerCommissionSettlement"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SellerCommissionSettlementItem_policyId_key" ON "SellerCommissionSettlementItem"("policyId");

-- CreateIndex
CREATE INDEX "SellerCommissionSettlementItem_organizationId_idx" ON "SellerCommissionSettlementItem"("organizationId");

-- CreateIndex
CREATE INDEX "SellerCommissionSettlementItem_settlementId_idx" ON "SellerCommissionSettlementItem"("settlementId");

-- CreateIndex
CREATE INDEX "Policy_organizationId_salespersonId_idx" ON "Policy"("organizationId", "salespersonId");

-- AddForeignKey
ALTER TABLE "CompanyCommissionPayment" ADD CONSTRAINT "CompanyCommissionPayment_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerCommissionSettlementItem" ADD CONSTRAINT "SellerCommissionSettlementItem_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "SellerCommissionSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerCommissionSettlementItem" ADD CONSTRAINT "SellerCommissionSettlementItem_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

