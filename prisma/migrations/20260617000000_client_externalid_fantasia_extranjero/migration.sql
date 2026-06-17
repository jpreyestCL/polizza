-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "esExtranjero" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "nombreFantasia" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Client_organizationId_externalId_key" ON "Client"("organizationId", "externalId");

