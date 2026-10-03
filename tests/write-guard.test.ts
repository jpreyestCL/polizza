import { afterAll, describe, expect, it } from "vitest";
import { basePrisma, getDb, TENANT_MODELS } from "@/server/db";
import {
  MODEL_WRITE_PERMISSIONS,
  WriteForbiddenError,
  canWriteModel,
} from "@/lib/domain/write-guard";

const SUPPORT = [
  "ActivityLog",
  "IdempotencyRecord",
  "Task",
  "Alert",
  "Comment",
  "Document",
  "DocumentVersion",
];

describe("permisos de escritura por modelo", () => {
  it("cubre cada modelo de la corredora", () => {
    const missing = [...TENANT_MODELS].filter(
      (model) => !MODEL_WRITE_PERMISSIONS[model] && !SUPPORT.includes(model),
    );
    expect(missing).toEqual([]);
  });

  it("solo lectura no escribe nada; administración y gerencia sí", () => {
    for (const model of TENANT_MODELS) {
      expect(canWriteModel("READ_ONLY", model)).toBe(false);
      expect(canWriteModel("ADMIN", model)).toBe(true);
      expect(canWriteModel("gerente", model)).toBe(true);
    }
  });

  it("cada rol escribe lo suyo y no lo ajeno", () => {
    expect(canWriteModel("COLLECTIONS", "InstallmentPayment")).toBe(true);
    expect(canWriteModel("COLLECTIONS", "Claim")).toBe(false);
    expect(canWriteModel("COLLECTIONS", "CommissionStatementLine")).toBe(false);
    expect(canWriteModel("CLAIMS", "Claim")).toBe(true);
    expect(canWriteModel("CLAIMS", "Endorsement")).toBe(false);
    expect(canWriteModel("CLAIMS", "Proposal")).toBe(false);
    expect(canWriteModel("FINANCE", "CommissionStatementLine")).toBe(true);
    // Importar no abre la escritura de pólizas: el lote usa su propio permiso.
    expect(canWriteModel("FINANCE", "Client")).toBe(false);
    expect(canWriteModel("FINANCE", "Proposal")).toBe(false);
    expect(canWriteModel("FINANCE", "Endorsement")).toBe(false);
    expect(canWriteModel("FINANCE", "ImportJob")).toBe(true);
    expect(canWriteModel("FINANCE", "TenantFeature")).toBe(false);
    expect(canWriteModel("ACCOUNT_EXECUTIVE", "TenantFeature")).toBe(false);
    expect(canWriteModel("ADMIN", "TenantFeature")).toBe(true);
    expect(canWriteModel("ACCOUNT_EXECUTIVE", "Proposal")).toBe(true);
    expect(canWriteModel("ACCOUNT_EXECUTIVE", "PolicyItem")).toBe(true);
    expect(canWriteModel("ejecutivo", "Client")).toBe(true);
    expect(canWriteModel("rol-inventado", "Client")).toBe(false);
  });
});

describe("guardia en el cliente de la corredora", () => {
  const org = `test-guard-${Date.now()}`;

  afterAll(async () => {
    await basePrisma.client.deleteMany({ where: { organizationId: org } });
    await basePrisma.$disconnect();
  });

  it("rechaza la escritura de un rol sin permiso y deja leer", async () => {
    const readOnly = getDb(org, { writerRole: "READ_ONLY" });
    await expect(
      readOnly.client.create({
        data: { organizationId: org, rut: "1-9", name: "Bloqueado" },
      }),
    ).rejects.toBeInstanceOf(WriteForbiddenError);
    await expect(readOnly.client.findMany()).resolves.toEqual([]);
  });

  it("deja escribir al rol con permiso y sin rol (procesos internos)", async () => {
    const admin = getDb(org, { writerRole: "ADMIN" });
    const created = await admin.client.create({
      data: { organizationId: org, rut: "2-7", name: "Permitido" },
    });
    expect(created.organizationId).toBe(org);
    await expect(
      getDb(org).client.update({
        where: { id: created.id },
        data: { name: "Proceso interno" },
      }),
    ).resolves.toMatchObject({ name: "Proceso interno" });
    await expect(
      getDb(org, { writerRole: "FINANCE" }).client.delete({
        where: { id: created.id },
      }),
    ).rejects.toBeInstanceOf(WriteForbiddenError);
  });
});
