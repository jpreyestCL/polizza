-- Producto contratado por póliza. En las emitidas en Polizza se hereda de la
-- propuesta; en las importadas lo completa el import desde el catálogo legacy.
-- FK suelta, igual que companyId / lineId / branchId en este modelo.
ALTER TABLE "Policy" ADD COLUMN "productId" TEXT;
CREATE INDEX "Policy_productId_idx" ON "Policy"("productId");
