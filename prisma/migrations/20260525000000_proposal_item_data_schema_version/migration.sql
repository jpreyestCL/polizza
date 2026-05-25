-- Versión del schema de `data` con que se persistió cada ProposalItem.
-- Permite migrar JSON al leer cuando el BranchFieldSchema cambia.
ALTER TABLE "ProposalItem"
  ADD COLUMN "dataSchemaVersion" INTEGER NOT NULL DEFAULT 1;
