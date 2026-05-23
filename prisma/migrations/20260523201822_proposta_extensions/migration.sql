-- AlterTable
ALTER TABLE "ProposalItemCoverage" ADD COLUMN     "autoLoaded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TenantProductCoverage" ADD COLUMN     "factor" DECIMAL(10,4),
ADD COLUMN     "premium" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "Commune" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commune_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Commune_code_key" ON "Commune"("code");

-- CreateIndex
CREATE INDEX "Commune_name_idx" ON "Commune"("name");
