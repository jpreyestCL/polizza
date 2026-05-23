import { describe, it, expect } from "vitest";
import { renewalInfo, needsRenewal } from "@/lib/renewal";

const now = new Date("2026-05-22T12:00:00Z");

describe("renewalInfo", () => {
  it("no alerta para pólizas no vigentes", () => {
    expect(
      renewalInfo("RENOVADA", new Date("2026-06-01T00:00:00Z"), now).level,
    ).toBe("ok");
  });

  it("no alerta sin fecha de término", () => {
    expect(renewalInfo("VIGENTE", null, now).level).toBe("ok");
  });

  it("marca urgente dentro de 30 días", () => {
    const result = renewalInfo(
      "VIGENTE",
      new Date("2026-06-10T00:00:00Z"),
      now,
    );
    expect(result.level).toBe("urgente");
    expect(result.daysToExpiry).toBe(19);
  });

  it("marca próxima entre 31 y 60 días", () => {
    expect(
      renewalInfo("VIGENTE", new Date("2026-07-15T00:00:00Z"), now).level,
    ).toBe("proxima");
  });

  it("marca vencida si la fecha ya pasó", () => {
    expect(
      renewalInfo("VIGENTE", new Date("2026-05-10T00:00:00Z"), now).level,
    ).toBe("vencida");
  });

  it("ok si falta más de 60 días", () => {
    expect(
      renewalInfo("VIGENTE", new Date("2026-12-01T00:00:00Z"), now).level,
    ).toBe("ok");
  });
});

describe("needsRenewal", () => {
  it("identifica los niveles que requieren atención", () => {
    expect(needsRenewal("urgente")).toBe(true);
    expect(needsRenewal("proxima")).toBe(true);
    expect(needsRenewal("vencida")).toBe(true);
    expect(needsRenewal("ok")).toBe(false);
  });
});
