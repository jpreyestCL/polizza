-- CreateEnum
CREATE TYPE "CarQuotationStatus" AS ENUM ('BORRADOR', 'EN_PROCESO', 'COMPLETADA', 'ERROR');

-- CreateEnum
CREATE TYPE "CarQuotationResultStatus" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'OBTENIDA', 'ERROR');

-- CreateEnum
CREATE TYPE "VehicleCondition" AS ENUM ('NUEVO', 'USADO');

-- CreateEnum
CREATE TYPE "VehicleUse" AS ENUM ('PARTICULAR', 'COMERCIAL');

-- CreateEnum
CREATE TYPE "CivilLiability" AS ENUM ('UF_500', 'UF_1000', 'UF_1500', 'UF_2000');

-- CreateEnum
CREATE TYPE "WorkshopType" AS ENUM ('EXCLUSIVIDAD', 'MARCA');

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'CAR_QUOTATION';

-- CreateTable
CREATE TABLE "CarQuotation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "status" "CarQuotationStatus" NOT NULL DEFAULT 'BORRADOR',
    "patente" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "anio" INTEGER,
    "tipoVehiculo" TEXT,
    "motorizacion" TEXT,
    "vehicleCondition" "VehicleCondition" NOT NULL DEFAULT 'USADO',
    "vehicleUse" "VehicleUse" NOT NULL DEFAULT 'PARTICULAR',
    "civilLiability" "CivilLiability" NOT NULL DEFAULT 'UF_500',
    "workshopType" "WorkshopType" NOT NULL DEFAULT 'EXCLUSIVIDAD',
    "deductibles" JSONB NOT NULL,
    "assignedUserId" TEXT,
    "createdById" TEXT,
    "previousQuotationId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarQuotationResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "insurerKey" TEXT NOT NULL,
    "insurerName" TEXT NOT NULL,
    "status" "CarQuotationResultStatus" NOT NULL DEFAULT 'PENDIENTE',
    "premiumUf" DECIMAL(14,2),
    "deductibleUf" DECIMAL(14,2),
    "planName" TEXT,
    "coverageDetail" JSONB,
    "rawData" JSONB,
    "pdfBytes" BYTEA,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarQuotationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsurerPortalCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "insurerKey" TEXT NOT NULL,
    "insurerName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "passwordIv" TEXT NOT NULL,
    "passwordTag" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVA',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsurerPortalCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarQuotation_organizationId_idx" ON "CarQuotation"("organizationId");

-- CreateIndex
CREATE INDEX "CarQuotation_clientId_idx" ON "CarQuotation"("clientId");

-- CreateIndex
CREATE INDEX "CarQuotation_previousQuotationId_idx" ON "CarQuotation"("previousQuotationId");

-- CreateIndex
CREATE UNIQUE INDEX "CarQuotation_organizationId_quotationNumber_key" ON "CarQuotation"("organizationId", "quotationNumber");

-- CreateIndex
CREATE INDEX "CarQuotationResult_organizationId_idx" ON "CarQuotationResult"("organizationId");

-- CreateIndex
CREATE INDEX "CarQuotationResult_quotationId_idx" ON "CarQuotationResult"("quotationId");

-- CreateIndex
CREATE INDEX "CarQuotationResult_status_idx" ON "CarQuotationResult"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CarQuotationResult_quotationId_insurerKey_key" ON "CarQuotationResult"("quotationId", "insurerKey");

-- CreateIndex
CREATE INDEX "InsurerPortalCredential_organizationId_idx" ON "InsurerPortalCredential"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "InsurerPortalCredential_organizationId_insurerKey_key" ON "InsurerPortalCredential"("organizationId", "insurerKey");

-- AddForeignKey
ALTER TABLE "CarQuotation" ADD CONSTRAINT "CarQuotation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarQuotationResult" ADD CONSTRAINT "CarQuotationResult_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "CarQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
