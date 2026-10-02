-- Cotización multi-compañía, cola de despacho, pago de cuota y rechazo.
-- RECHAZADA no se usa en este archivo: Postgres 16 permite agregar el
-- valor en la misma transacción si ninguna fila lo escribe aquí.

ALTER TYPE "ProposalStatus" ADD VALUE 'RECHAZADA';

CREATE TYPE "QuoteRequestStatus" AS ENUM (
  'BORRADOR',
  'SOLICITADA',
  'COTIZADA',
  'ENVIADA_CLIENTE',
  'GANADA',
  'PERDIDA'
);

CREATE TABLE "QuoteRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "QuoteRequestStatus" NOT NULL DEFAULT 'BORRADOR',
  "currency" TEXT NOT NULL DEFAULT 'UF',
  "lossReason" TEXT,
  "proposalId" TEXT,
  "assignedUserId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteOffer" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "insurerName" TEXT NOT NULL,
  "premiumNet" DECIMAL(18,4),
  "currency" TEXT NOT NULL DEFAULT 'UF',
  "notes" TEXT,
  "recommended" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Dispatch" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "policyId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "recipientEmail" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Dispatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstallmentPayment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "installmentId" TEXT NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "paidOn" DATE NOT NULL,
  "companyRegisteredOn" DATE,
  "markedOn" DATE NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstallmentPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuoteRequest_proposalId_key" ON "QuoteRequest"("proposalId");
CREATE INDEX "QuoteRequest_organizationId_idx" ON "QuoteRequest"("organizationId");
CREATE INDEX "QuoteRequest_clientId_idx" ON "QuoteRequest"("clientId");
CREATE INDEX "QuoteOffer_organizationId_idx" ON "QuoteOffer"("organizationId");
CREATE INDEX "QuoteOffer_requestId_idx" ON "QuoteOffer"("requestId");
CREATE INDEX "Dispatch_organizationId_idx" ON "Dispatch"("organizationId");
CREATE INDEX "Dispatch_proposalId_idx" ON "Dispatch"("proposalId");
CREATE INDEX "Dispatch_status_idx" ON "Dispatch"("status");
CREATE INDEX "InstallmentPayment_organizationId_idx" ON "InstallmentPayment"("organizationId");
CREATE INDEX "InstallmentPayment_installmentId_idx" ON "InstallmentPayment"("installmentId");

ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuoteOffer" ADD CONSTRAINT "QuoteOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstallmentPayment" ADD CONSTRAINT "InstallmentPayment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
