-- CreateIndex
CREATE INDEX "Client_organizationId_email_idx" ON "Client"("organizationId", "email");

-- CreateIndex
CREATE INDEX "ClientContact_organizationId_email_idx" ON "ClientContact"("organizationId", "email");
