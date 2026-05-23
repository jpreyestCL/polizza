-- CreateEnum
CREATE TYPE "PaymentOption" AS ENUM ('CONTADO', 'AVISO_CUOTA', 'CHEQUES', 'PAC', 'PAT', 'CUPONERA', 'OTRO');

-- CreateEnum
CREATE TYPE "EndorsementType" AS ENUM ('CANCELACION', 'ANULACION', 'MODIFICACION');

-- AlterEnum
ALTER TYPE "PolicyStatus" ADD VALUE 'ANULADA';

-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "paymentPlanId" TEXT,
ALTER COLUMN "policyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InsuranceCompany" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bankAccountClp" TEXT,
ADD COLUMN     "bankAccountUsd" TEXT,
ADD COLUMN     "brokerCode" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "commune" TEXT,
ADD COLUMN     "defaultEmail" TEXT,
ADD COLUMN     "globalCompanyId" TEXT,
ADD COLUMN     "isLife" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "paymentLink" TEXT,
ADD COLUMN     "url" TEXT;

-- AlterTable
ALTER TABLE "InsuranceProduct" DROP COLUMN "companyId",
DROP COLUMN "lineId",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "branchTypeId" TEXT,
ADD COLUMN     "commissionAffectPct" DECIMAL(6,3),
ADD COLUMN     "commissionExemptPct" DECIMAL(6,3),
ADD COLUMN     "globalProductId" TEXT,
ADD COLUMN     "insuranceCompanyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "beneficiaryClientId" TEXT,
ADD COLUMN     "branchTypeId" TEXT,
ADD COLUMN     "coCorredor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "coCorredorDetails" JSONB,
ADD COLUMN     "coaseguro" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "coaseguroDetails" JSONB,
ADD COLUMN     "commissionAffectPct" DECIMAL(6,3),
ADD COLUMN     "commissionExemptPct" DECIMAL(6,3),
ADD COLUMN     "conClausulaInalterabilidad" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "conReserva" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deOtroCorredor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "facultativo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "garantiaSuscripcion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "insuredClientId" TEXT,
ADD COLUMN     "observations" TEXT,
ADD COLUMN     "previousPolicyId" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "quotationId" TEXT,
ADD COLUMN     "quotationNumberRef" TEXT,
ADD COLUMN     "reaseguro" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reaseguroDetails" JSONB,
ADD COLUMN     "recipientContactId" TEXT,
ADD COLUMN     "recipientEmail" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuperadmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "GlobalInsuranceCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "rut" TEXT,
    "address" TEXT,
    "commune" TEXT,
    "city" TEXT,
    "url" TEXT,
    "logoUrl" TEXT,
    "isLife" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalInsuranceCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceCompanyContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "insuranceCompanyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "celular" TEXT,
    "role" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceCompanyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchFieldSchema" (
    "id" TEXT NOT NULL,
    "branchTypeId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "helpText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchFieldSchema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalInsuranceProduct" (
    "id" TEXT NOT NULL,
    "globalCompanyId" TEXT NOT NULL,
    "branchTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "commissionAffectPct" DECIMAL(6,3),
    "commissionExemptPct" DECIMAL(6,3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalInsuranceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalProductCoverage" (
    "id" TEXT NOT NULL,
    "globalProductId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "polCad" TEXT,
    "text" TEXT,
    "insuredAmount" DECIMAL(16,2),
    "type" TEXT NOT NULL,
    "isCommercialValue" BOOLEAN NOT NULL DEFAULT false,
    "affectedByIva" BOOLEAN NOT NULL DEFAULT false,
    "sumsToTotal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalProductCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantProductCoverage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "polCad" TEXT,
    "text" TEXT,
    "insuredAmount" DECIMAL(16,2),
    "type" TEXT NOT NULL,
    "isCommercialValue" BOOLEAN NOT NULL DEFAULT false,
    "affectedByIva" BOOLEAN NOT NULL DEFAULT false,
    "sumsToTotal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantProductCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "branchTypeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "insuredClientId" TEXT,
    "beneficiaryClientId" TEXT,
    "identification" TEXT,
    "glossNote" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalItemCoverage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "polCad" TEXT,
    "type" TEXT NOT NULL,
    "isCommercialValue" BOOLEAN NOT NULL DEFAULT false,
    "insuredAmount" DECIMAL(16,2),
    "insuredCurrency" TEXT NOT NULL DEFAULT 'UF',
    "affectedByIva" BOOLEAN NOT NULL DEFAULT false,
    "taxRateAffect" DECIMAL(7,4),
    "taxRateExempt" DECIMAL(7,4),
    "premiumAffect" DECIMAL(14,2),
    "premiumExempt" DECIMAL(14,2),
    "premiumNet" DECIMAL(14,2),
    "ivaAmount" DECIMAL(14,2),
    "premiumGross" DECIMAL(14,2),
    "commissionAffectPct" DECIMAL(6,3),
    "commissionExemptPct" DECIMAL(6,3),
    "commissionAmount" DECIMAL(14,2),
    "sumsToTotal" BOOLEAN NOT NULL DEFAULT true,
    "manualPremium" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalItemCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "policyId" TEXT,
    "sinPlanDePago" BOOLEAN NOT NULL DEFAULT false,
    "option" "PaymentOption",
    "installmentsCount" INTEGER NOT NULL DEFAULT 0,
    "observations" TEXT,
    "documented" BOOLEAN NOT NULL DEFAULT false,
    "firstPaymentDate" DATE,
    "firstSignDate" DATE,
    "valorCuota" DECIMAL(14,2),
    "cobrAnticipada" BOOLEAN NOT NULL DEFAULT false,
    "facturaAnticipada" BOOLEAN NOT NULL DEFAULT false,
    "requiereFactura" BOOLEAN NOT NULL DEFAULT false,
    "primaBruta" DECIMAL(14,4),
    "cambio" DECIMAL(14,4),
    "primaTotalPesos" DECIMAL(14,2),
    "payerRut" TEXT,
    "payerName" TEXT,
    "payerLastName" TEXT,
    "payerLegalName" TEXT,
    "payerPhone" TEXT,
    "payerCelular" TEXT,
    "payerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    "nextDueDate" TIMESTAMP(3),
    "responsibleUserId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endorsement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "type" "EndorsementType" NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Endorsement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalInsuranceCompany_name_key" ON "GlobalInsuranceCompany"("name");

-- CreateIndex
CREATE INDEX "InsuranceCompanyContact_organizationId_idx" ON "InsuranceCompanyContact"("organizationId");

-- CreateIndex
CREATE INDEX "InsuranceCompanyContact_insuranceCompanyId_idx" ON "InsuranceCompanyContact"("insuranceCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchType_key_key" ON "BranchType"("key");

-- CreateIndex
CREATE INDEX "BranchFieldSchema_branchTypeId_idx" ON "BranchFieldSchema"("branchTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchFieldSchema_branchTypeId_fieldKey_key" ON "BranchFieldSchema"("branchTypeId", "fieldKey");

-- CreateIndex
CREATE INDEX "GlobalInsuranceProduct_branchTypeId_idx" ON "GlobalInsuranceProduct"("branchTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalInsuranceProduct_globalCompanyId_name_key" ON "GlobalInsuranceProduct"("globalCompanyId", "name");

-- CreateIndex
CREATE INDEX "GlobalProductCoverage_globalProductId_idx" ON "GlobalProductCoverage"("globalProductId");

-- CreateIndex
CREATE INDEX "TenantProductCoverage_organizationId_idx" ON "TenantProductCoverage"("organizationId");

-- CreateIndex
CREATE INDEX "TenantProductCoverage_productId_idx" ON "TenantProductCoverage"("productId");

-- CreateIndex
CREATE INDEX "ProposalItem_organizationId_idx" ON "ProposalItem"("organizationId");

-- CreateIndex
CREATE INDEX "ProposalItem_proposalId_idx" ON "ProposalItem"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalItemCoverage_organizationId_idx" ON "ProposalItemCoverage"("organizationId");

-- CreateIndex
CREATE INDEX "ProposalItemCoverage_itemId_idx" ON "ProposalItemCoverage"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentPlan_proposalId_key" ON "PaymentPlan"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentPlan_policyId_key" ON "PaymentPlan"("policyId");

-- CreateIndex
CREATE INDEX "PaymentPlan_organizationId_idx" ON "PaymentPlan"("organizationId");

-- CreateIndex
CREATE INDEX "ProposalLog_organizationId_idx" ON "ProposalLog"("organizationId");

-- CreateIndex
CREATE INDEX "ProposalLog_proposalId_idx" ON "ProposalLog"("proposalId");

-- CreateIndex
CREATE INDEX "Endorsement_organizationId_idx" ON "Endorsement"("organizationId");

-- CreateIndex
CREATE INDEX "Endorsement_policyId_idx" ON "Endorsement"("policyId");

-- CreateIndex
CREATE INDEX "Installment_paymentPlanId_idx" ON "Installment"("paymentPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceCompany_organizationId_globalCompanyId_key" ON "InsuranceCompany"("organizationId", "globalCompanyId");

-- CreateIndex
CREATE INDEX "InsuranceProduct_insuranceCompanyId_idx" ON "InsuranceProduct"("insuranceCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceProduct_organizationId_insuranceCompanyId_globalPr_key" ON "InsuranceProduct"("organizationId", "insuranceCompanyId", "globalProductId");

-- CreateIndex
CREATE INDEX "Proposal_previousPolicyId_idx" ON "Proposal"("previousPolicyId");

-- CreateIndex
CREATE INDEX "Proposal_quotationId_idx" ON "Proposal"("quotationId");

-- AddForeignKey
ALTER TABLE "InsuranceCompany" ADD CONSTRAINT "InsuranceCompany_globalCompanyId_fkey" FOREIGN KEY ("globalCompanyId") REFERENCES "GlobalInsuranceCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceCompanyContact" ADD CONSTRAINT "InsuranceCompanyContact_insuranceCompanyId_fkey" FOREIGN KEY ("insuranceCompanyId") REFERENCES "InsuranceCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchFieldSchema" ADD CONSTRAINT "BranchFieldSchema_branchTypeId_fkey" FOREIGN KEY ("branchTypeId") REFERENCES "BranchType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalInsuranceProduct" ADD CONSTRAINT "GlobalInsuranceProduct_globalCompanyId_fkey" FOREIGN KEY ("globalCompanyId") REFERENCES "GlobalInsuranceCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalInsuranceProduct" ADD CONSTRAINT "GlobalInsuranceProduct_branchTypeId_fkey" FOREIGN KEY ("branchTypeId") REFERENCES "BranchType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalProductCoverage" ADD CONSTRAINT "GlobalProductCoverage_globalProductId_fkey" FOREIGN KEY ("globalProductId") REFERENCES "GlobalInsuranceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceProduct" ADD CONSTRAINT "InsuranceProduct_globalProductId_fkey" FOREIGN KEY ("globalProductId") REFERENCES "GlobalInsuranceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceProduct" ADD CONSTRAINT "InsuranceProduct_insuranceCompanyId_fkey" FOREIGN KEY ("insuranceCompanyId") REFERENCES "InsuranceCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceProduct" ADD CONSTRAINT "InsuranceProduct_branchTypeId_fkey" FOREIGN KEY ("branchTypeId") REFERENCES "BranchType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantProductCoverage" ADD CONSTRAINT "TenantProductCoverage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InsuranceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_branchTypeId_fkey" FOREIGN KEY ("branchTypeId") REFERENCES "BranchType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_branchTypeId_fkey" FOREIGN KEY ("branchTypeId") REFERENCES "BranchType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalItemCoverage" ADD CONSTRAINT "ProposalItemCoverage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ProposalItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalLog" ADD CONSTRAINT "ProposalLog_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

