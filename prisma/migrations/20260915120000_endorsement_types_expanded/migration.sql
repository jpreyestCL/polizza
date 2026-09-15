-- Amplía EndorsementType de 3 a 16 tipos (lista operativa de la corredora).
-- CANCELACION y ANULACION se reemplazan por los tipos específicos
-- (CANCELACION_COMPANIA / CANCELACION_NO_PAGO / ANULACION_COMPANIA).
-- No hay filas en Endorsement al momento de esta migración, así que el tipo
-- se recrea sin necesidad de mapear datos existentes.

ALTER TYPE "EndorsementType" RENAME TO "EndorsementType_old";

CREATE TYPE "EndorsementType" AS ENUM (
  'AGREGA_ITEMS',
  'ELIMINA_ITEMS',
  'ANULACION_ENDOSO',
  'ANULACION_COMPANIA',
  'CAMBIO_ASEGURADO_POLIZA',
  'CAMBIO_ASEGURADO_ITEM',
  'CANCELACION_COMPANIA',
  'CANCELACION_NO_PAGO',
  'CORTE_PERDIDA_TOTAL',
  'ENDOSO_INTERNO',
  'MODIFICACION_GLOSA_ITEM',
  'MODIFICA_MONTO_PRIMA',
  'MODIFICACION',
  'PRORROGA',
  'SOLICITUD_ANULACION',
  'SOLICITUD_CANCELACION'
);

ALTER TABLE "Endorsement"
  ALTER COLUMN "type" TYPE "EndorsementType"
  USING (
    CASE "type"::text
      WHEN 'CANCELACION' THEN 'CANCELACION_COMPANIA'
      WHEN 'ANULACION'   THEN 'ANULACION_COMPANIA'
      ELSE 'MODIFICACION'
    END
  )::"EndorsementType";

DROP TYPE "EndorsementType_old";
