-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EndorsementType" ADD VALUE 'REEMPLAZA_ITEMS';
ALTER TYPE "EndorsementType" ADD VALUE 'REHABILITACION';
ALTER TYPE "EndorsementType" ADD VALUE 'CAMBIO_CORREDOR';

-- AlterTable
ALTER TABLE "Endorsement" ADD COLUMN     "itemDescription" TEXT,
ADD COLUMN     "targetItemId" TEXT;

-- AlterTable
ALTER TABLE "PolicyItem" ADD COLUMN     "addedByEndorsementId" TEXT,
ADD COLUMN     "removedAt" DATE,
ADD COLUMN     "removedByEndorsementId" TEXT;

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "endorsementItemDescription" TEXT,
ADD COLUMN     "endorsementTargetItemId" TEXT;

