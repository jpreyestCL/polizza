-- Recepción de la póliza emitida por la compañía (flujo post-envío) +
-- almacenamiento de archivos subidos al servidor para documentos.

-- AlterTable
ALTER TABLE "Proposal"
  ADD COLUMN "policyNumberGenerated" TEXT,
  ADD COLUMN "policyEmissionDate" DATE,
  ADD COLUMN "policyReceptionDate" DATE,
  ADD COLUMN "emissionErrorReason" TEXT,
  ADD COLUMN "emissionErrorDetail" TEXT;

-- AlterTable
ALTER TABLE "Document"
  ADD COLUMN "storageKey" TEXT;
