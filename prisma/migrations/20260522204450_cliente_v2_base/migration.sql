-- CreateEnum
CREATE TYPE "ContactAssignment" AS ENUM ('COBRANZA', 'SINIESTROS', 'EMISION');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "cobranzaUserId" TEXT,
ADD COLUMN     "comentarioAlerta" TEXT,
ADD COLUMN     "giro" TEXT,
ADD COLUMN     "holdingId" TEXT,
ADD COLUMN     "siniestrosUserId" TEXT,
ADD COLUMN     "vendedor" TEXT;

-- AlterTable
ALTER TABLE "ClientContact" ADD COLUMN     "assignmentType" "ContactAssignment";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "description" TEXT,
ADD COLUMN     "year" INTEGER;

-- AlterTable
ALTER TABLE "Policy" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "branchId" TEXT;

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contactName" TEXT,
    "commune" TEXT,
    "region" TEXT,
    "phone" TEXT,
    "celular" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Holding_organizationId_idx" ON "Holding"("organizationId");

-- CreateIndex
CREATE INDEX "Branch_organizationId_idx" ON "Branch"("organizationId");

-- CreateIndex
CREATE INDEX "Branch_clientId_idx" ON "Branch"("clientId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
