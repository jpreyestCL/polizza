import { describe, it, expect, afterAll } from "vitest";
import { basePrisma, getDb } from "@/server/db";

const orgA = `test-org-a-${Date.now()}`;
const orgB = `test-org-b-${Date.now()}`;

describe("aislamiento multi-tenant", () => {
  afterAll(async () => {
    await basePrisma.client.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await basePrisma.$disconnect();
  });

  it("inyecta el organizationId al crear", async () => {
    const clientA = await getDb(orgA).client.create({
      data: { rut: "1-9", name: "Cliente A" },
    });
    const clientB = await getDb(orgB).client.create({
      data: { rut: "2-7", name: "Cliente B" },
    });
    expect(clientA.organizationId).toBe(orgA);
    expect(clientB.organizationId).toBe(orgB);
  });

  it("no filtra clientes de otra organización en las lecturas", async () => {
    const fromA = await getDb(orgA).client.findMany();
    expect(fromA.length).toBeGreaterThan(0);
    expect(fromA.every((c) => c.organizationId === orgA)).toBe(true);
    expect(fromA.some((c) => c.name === "Cliente B")).toBe(false);
  });

  it("no permite actualizar un cliente de otro tenant", async () => {
    const clientB = await getDb(orgB).client.findFirst({
      where: { name: "Cliente B" },
    });
    expect(clientB).not.toBeNull();

    const result = await getDb(orgA).client.updateMany({
      where: { id: clientB!.id },
      data: { name: "intento-de-acceso" },
    });
    expect(result.count).toBe(0);

    const stillB = await getDb(orgB).client.findFirst({
      where: { id: clientB!.id },
    });
    expect(stillB?.name).toBe("Cliente B");
  });
});
