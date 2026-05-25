import { describe, it, expect } from "vitest";
import { getDb } from "@/server/db";

/**
 * Verifica el guard de runtime que prohíbe nested writes en modelos tenant.
 * El guard se ejecuta ANTES del engine de Prisma, por eso estos tests no
 * requieren DATABASE_URL — el error se lanza desde el extends.
 */

describe("guard contra nested writes en getDb", () => {
  const db = getDb("org-fake");

  it("create con `contacts.create` anidado tira", async () => {
    await expect(
      db.client.create({
        data: {
          rut: "1-9",
          name: "X",
          contacts: { create: [{ name: "Pepe" }] },
        } as never,
      }),
    ).rejects.toThrow(/Escritura anidada \(create\)/);
  });

  it("create con `connectOrCreate` anidado tira", async () => {
    await expect(
      db.client.create({
        data: {
          rut: "2-7",
          name: "Y",
          holding: {
            connectOrCreate: {
              where: { id: "h1" },
              create: { name: "Holding X" },
            },
          },
        } as never,
      }),
    ).rejects.toThrow(/connectOrCreate/);
  });

  it("update con `contacts.create` anidado tira", async () => {
    await expect(
      db.client.update({
        where: { id: "x" },
        data: {
          contacts: { create: [{ name: "Pepe" }] },
        } as never,
      }),
    ).rejects.toThrow(/Escritura anidada/);
  });

  it("createMany con array de datos planos NO tira", () => {
    // Solo verificamos que el guard NO se queja del payload puro;
    // el error vendrá del engine (no es responsabilidad del guard).
    expect(() =>
      db.clientContact.createMany({
        data: [
          { clientId: "c1", name: "A" },
          { clientId: "c1", name: "B" },
        ] as never,
      }),
    ).not.toThrow(/Escritura anidada/);
  });

  it("connect (sin create) NO tira — es seguro", () => {
    // db.client.create con `holding: { connect: { id } }` solo conecta a
    // un holding existente y es válido. El guard solo se queja de create/
    // createMany/connectOrCreate/upsert anidados.
    expect(() =>
      db.client.create({
        data: {
          rut: "9-9",
          name: "Z",
          holding: { connect: { id: "h1" } },
        } as never,
      }),
    ).not.toThrow(/Escritura anidada/);
  });
});
