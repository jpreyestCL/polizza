-- CreateEnum
CREATE TYPE "DataSubjectRequestType" AS ENUM ('ACCESS', 'RECTIFICATION', 'DELETION', 'OPPOSITION', 'PORTABILITY', 'BLOCKING');

-- CreateEnum
CREATE TYPE "DataSubjectRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ComplianceObligationStatus" AS ENUM ('PENDING', 'DONE', 'WAIVED');

-- CreateEnum
CREATE TYPE "CollectionReminderKind" AS ENUM ('ADVANCE', 'OVERDUE', 'REJECTED', 'LAPSE');

-- AlterTable
ALTER TABLE "ImportJob" ADD COLUMN     "fileSha256" TEXT,
ADD COLUMN     "fileSize" INTEGER;

-- AlterTable
ALTER TABLE "OrganizationSettings" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedById" TEXT;

-- CreateTable
CREATE TABLE "DataSubjectRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "DataSubjectRequestType" NOT NULL,
    "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'OPEN',
    "channel" TEXT,
    "requestNote" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" DATE NOT NULL,
    "completedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "handledById" TEXT,
    "sensitiveReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceObligation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATE NOT NULL,
    "status" "ComplianceObligationStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "completedNote" TEXT,
    "assignedUserId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionReminder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "kind" "CollectionReminderKind" NOT NULL,
    "sentTo" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentById" TEXT,
    "dedupeKey" TEXT NOT NULL,

    CONSTRAINT "CollectionReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataSubjectRequest_organizationId_idx" ON "DataSubjectRequest"("organizationId");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_organizationId_status_idx" ON "DataSubjectRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_clientId_idx" ON "DataSubjectRequest"("clientId");

-- CreateIndex
CREATE INDEX "ComplianceObligation_organizationId_idx" ON "ComplianceObligation"("organizationId");

-- CreateIndex
CREATE INDEX "ComplianceObligation_organizationId_dueDate_idx" ON "ComplianceObligation"("organizationId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceObligation_organizationId_code_dueDate_key" ON "ComplianceObligation"("organizationId", "code", "dueDate");

-- CreateIndex
CREATE INDEX "CollectionReminder_organizationId_idx" ON "CollectionReminder"("organizationId");

-- CreateIndex
CREATE INDEX "CollectionReminder_installmentId_idx" ON "CollectionReminder"("installmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionReminder_organizationId_dedupeKey_key" ON "CollectionReminder"("organizationId", "dedupeKey");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_organizationId_fileSha256_idx" ON "ImportJob"("organizationId", "fileSha256");

-- AddForeignKey
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionReminder" ADD CONSTRAINT "CollectionReminder_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
