-- AlterEnum
ALTER TYPE "ProposalStatus" ADD VALUE 'POR_ENVIAR' AFTER 'ELABORACION';

-- AlterTable
ALTER TABLE "Proposal"
  ADD COLUMN "pdfBytes" BYTEA,
  ADD COLUMN "pdfGeneratedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Organization"
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Santiago';
