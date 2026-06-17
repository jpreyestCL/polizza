-- AlterTable
ALTER TABLE "ClientContact" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "notes" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ClientContact_organizationId_externalId_key" ON "ClientContact"("organizationId", "externalId");

