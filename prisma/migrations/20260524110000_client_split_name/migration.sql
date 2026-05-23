-- Split de "name" en firstName, lastNamePaterno, lastNameMaterno para personas.
-- Mantenemos "name" como espejo concatenado para compatibilidad con queries
-- existentes (búsquedas, listados, logs).

ALTER TABLE "Client" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Client" ADD COLUMN "lastNamePaterno" TEXT;
ALTER TABLE "Client" ADD COLUMN "lastNameMaterno" TEXT;

-- Backfill best-effort para clientes tipo PERSONA:
--   1 palabra      -> firstName
--   2 palabras     -> firstName, lastNamePaterno
--   3 palabras     -> firstName, lastNamePaterno, lastNameMaterno
--   4+ palabras    -> primeras N-2 a firstName, penúltima a paterno, última a materno
UPDATE "Client"
SET
  "firstName" = CASE
    WHEN array_length(regexp_split_to_array(trim("name"), '\s+'), 1) <= 2
      THEN (regexp_split_to_array(trim("name"), '\s+'))[1]
    WHEN array_length(regexp_split_to_array(trim("name"), '\s+'), 1) = 3
      THEN (regexp_split_to_array(trim("name"), '\s+'))[1]
    ELSE array_to_string(
      (regexp_split_to_array(trim("name"), '\s+'))[1:array_length(regexp_split_to_array(trim("name"), '\s+'), 1) - 2],
      ' '
    )
  END,
  "lastNamePaterno" = CASE
    WHEN array_length(regexp_split_to_array(trim("name"), '\s+'), 1) >= 2
      THEN (regexp_split_to_array(trim("name"), '\s+'))[array_length(regexp_split_to_array(trim("name"), '\s+'), 1) - 1]
    ELSE NULL
  END,
  "lastNameMaterno" = CASE
    WHEN array_length(regexp_split_to_array(trim("name"), '\s+'), 1) >= 3
      THEN (regexp_split_to_array(trim("name"), '\s+'))[array_length(regexp_split_to_array(trim("name"), '\s+'), 1)]
    ELSE NULL
  END
WHERE "type" = 'PERSONA' AND "name" IS NOT NULL AND trim("name") <> '';

-- Caso especial: si nombre tenía solo 2 palabras, el CASE de arriba puso
-- la última como paterno y dejó materno en NULL — correcto.
-- Si tenía 1 palabra, paterno queda NULL — también correcto.
