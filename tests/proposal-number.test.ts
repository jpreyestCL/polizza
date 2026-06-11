import { describe, it, expect } from "vitest";
import {
  isDraftProposalNumber,
  formatProposalNumber,
} from "@/lib/proposal-number";

describe("isDraftProposalNumber", () => {
  it("detecta el placeholder DRAFT-<timestamp>", () => {
    expect(isDraftProposalNumber("DRAFT-1781129872742")).toBe(true);
  });

  it("trata null/undefined/vacío como borrador", () => {
    expect(isDraftProposalNumber(null)).toBe(true);
    expect(isDraftProposalNumber(undefined)).toBe(true);
    expect(isDraftProposalNumber("")).toBe(true);
  });

  it("no marca como borrador un número real", () => {
    expect(isDraftProposalNumber("2026-0001")).toBe(false);
    expect(isDraftProposalNumber("P-2026-0002")).toBe(false);
  });
});

describe("formatProposalNumber", () => {
  it("oculta el timestamp interno mostrando 'Borrador'", () => {
    expect(formatProposalNumber("DRAFT-1781129872742")).toBe("Borrador");
    expect(formatProposalNumber(null)).toBe("Borrador");
  });

  it("muestra el número real sin cambios", () => {
    expect(formatProposalNumber("2026-0001")).toBe("2026-0001");
    expect(formatProposalNumber("P-2026-0002")).toBe("P-2026-0002");
  });
});
