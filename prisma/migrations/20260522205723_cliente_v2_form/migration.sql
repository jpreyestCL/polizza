-- Cliente V2: renombra columnas preservando datos y agrega fecha de nacimiento.
ALTER TABLE "Client" RENAME COLUMN "whatsapp" TO "celular";
ALTER TABLE "Client" RENAME COLUMN "notes" TO "observaciones";
ALTER TABLE "Client" ADD COLUMN "birthDate" DATE;
