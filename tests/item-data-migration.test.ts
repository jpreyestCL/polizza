import { describe, it, expect } from "vitest";
import {
  migrateItemData,
  migrateItemDataList,
  CURRENT_DATA_SCHEMA_VERSION,
} from "@/lib/item-data-migration";

describe("migrateItemData", () => {
  it("devuelve data tal cual si ya está en la versión actual", () => {
    const data = { foo: "bar" };
    const r = migrateItemData(data, CURRENT_DATA_SCHEMA_VERSION);
    expect(r.migrated).toBe(false);
    expect(r.data).toEqual(data);
    expect(r.version).toBe(CURRENT_DATA_SCHEMA_VERSION);
  });

  it("normaliza data nulo o no objeto a {}", () => {
    expect(migrateItemData(null, 1).data).toEqual({});
    expect(migrateItemData(42, 1).data).toEqual({});
    expect(migrateItemData("x", 1).data).toEqual({});
  });

  it("trata fromVersion null/undefined como 1", () => {
    const r = migrateItemData({ a: 1 }, null);
    expect(r.version).toBe(CURRENT_DATA_SCHEMA_VERSION);
  });

  it("no muta la entrada original", () => {
    const data = { foo: "bar" };
    migrateItemData(data, 1);
    expect(data).toEqual({ foo: "bar" });
  });
});

describe("migrateItemDataList", () => {
  it("aplica migración a cada item y conserva campos extra", () => {
    const list = [
      { id: "1", data: { foo: 1 }, dataSchemaVersion: 1, extra: "x" },
      { id: "2", data: { foo: 2 }, dataSchemaVersion: null, extra: "y" },
    ];
    const out = migrateItemDataList(list);
    expect(out).toHaveLength(2);
    expect(out[0].extra).toBe("x");
    expect(out[0].dataSchemaVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
    expect(out[1].dataSchemaVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
  });
});
