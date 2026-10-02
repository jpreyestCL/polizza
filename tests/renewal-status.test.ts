import { describe, expect, it } from "vitest";
import {
  addRetentionCount,
  deriveRenewalStatus,
  emptyRetentionCounts,
  retentionRate,
} from "@/lib/domain/renewal-status";
import { successorState } from "@/lib/domain/successor";
import { agingBucket } from "@/lib/domain/aging";

const now = new Date("2026-10-02T12:00:00.000Z");
const end = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const base = {
  policyStatus: "VIGENTE" as const,
  endDate: end("2026-11-01"),
  notRenewable: false,
  nonRenewalRecorded: false,
  successor: "NONE" as const,
  now,
};

describe("deriveRenewalStatus", () => {
  it("evalúa en el orden de la especificación", () => {
    expect(deriveRenewalStatus({ ...base, successor: "ISSUED" })).toBe("RENEWED");
    expect(deriveRenewalStatus({ ...base, successor: "IN_PROGRESS" })).toBe(
      "IN_PROGRESS",
    );
    expect(
      deriveRenewalStatus({
        ...base,
        endDate: end("2026-09-01"),
        successor: "IN_PROGRESS",
      }),
    ).toBe("EXPIRED_IN_PROGRESS");
    expect(deriveRenewalStatus({ ...base, nonRenewalRecorded: true })).toBe(
      "NOT_RENEWED",
    );
    expect(deriveRenewalStatus({ ...base, notRenewable: true })).toBe(
      "NOT_RENEWABLE",
    );
    expect(deriveRenewalStatus({ ...base, successor: "LOST" })).toBe("LOST");
    expect(
      deriveRenewalStatus({ ...base, endDate: end("2026-09-01") }),
    ).toBe("EXPIRED_UNMANAGED");
    expect(deriveRenewalStatus(base)).toBe("PENDING");
    expect(
      deriveRenewalStatus({ ...base, endDate: end("2027-06-01") }),
    ).toBe("NOT_DUE");
  });

  it("una sucesora emitida manda aunque esté vencida", () => {
    expect(
      deriveRenewalStatus({
        ...base,
        policyStatus: "RENOVADA",
        endDate: end("2026-01-01"),
        successor: "ISSUED",
      }),
    ).toBe("RENEWED");
  });
});

describe("successorState", () => {
  it("prioriza una sucesora emitida sobre una propuesta abierta", () => {
    expect(
      successorState({
        childStatuses: ["VIGENTE"],
        proposalStatuses: ["ELABORACION"],
      }),
    ).toBe("ISSUED");
  });

  it("trata la hija anulada como renovación perdida", () => {
    expect(
      successorState({ childStatuses: ["ANULADA"], proposalStatuses: [] }),
    ).toBe("LOST");
  });
});

describe("agingBucket", () => {
  it("agrupa la mora en tramos", () => {
    expect(agingBucket(12)).toBe("1-30");
    expect(agingBucket(45)).toBe("31-60");
    expect(agingBucket(90)).toBe("61-90");
    expect(agingBucket(120)).toBe("90+");
  });
});

describe("retentionRate", () => {
  it("excluye las no renovables del denominador", () => {
    const counts = emptyRetentionCounts();
    addRetentionCount(counts, "RENEWED");
    addRetentionCount(counts, "RENEWED");
    addRetentionCount(counts, "NOT_RENEWED");
    addRetentionCount(counts, "NOT_RENEWABLE");
    expect(counts.universe).toBe(4);
    expect(retentionRate(counts)).toBeCloseTo(2 / 3, 8);
  });

  it("es null si todo el universo es no renovable", () => {
    const counts = emptyRetentionCounts();
    addRetentionCount(counts, "NOT_RENEWABLE");
    expect(retentionRate(counts)).toBeNull();
  });
});
