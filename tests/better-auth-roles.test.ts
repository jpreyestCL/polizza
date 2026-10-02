import { describe, expect, it } from "vitest";
import { roles } from "@/lib/permissions";
import { FACTORY_ROLES, factoryRoleOf } from "@/lib/factory-roles";

describe("roles de Better Auth", () => {
  it("registra los seis roles de fábrica y conserva los históricos", () => {
    for (const role of FACTORY_ROLES) {
      expect(Object.keys(roles)).toContain(role);
      expect(factoryRoleOf(role)).toBe(role);
    }
    for (const legacy of ["admin", "gerente", "ejecutivo"]) {
      expect(Object.keys(roles)).toContain(legacy);
    }
  });
});
