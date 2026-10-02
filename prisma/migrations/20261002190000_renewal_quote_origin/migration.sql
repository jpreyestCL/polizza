-- La recotización de una renovación no es la sucesora.
-- Guarda el origen y la póliza de la que sale.

ALTER TABLE "QuoteRequest" ADD COLUMN "origin" TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN "sourcePolicyId" TEXT;

CREATE INDEX "QuoteRequest_sourcePolicyId_idx" ON "QuoteRequest"("sourcePolicyId");
