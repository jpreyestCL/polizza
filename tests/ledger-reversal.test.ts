import { describe, expect, it } from "vitest";
import { negateCommission } from "@/features/ledger/record";

describe("reverso de comisión", () => {
  it("niega la comisión ya asentada, sin recalcularla en cero", () => {
    expect(
      negateCommission({ affected: 2.72, exempt: 2.7, total: 5.42 }),
    ).toEqual({ affected: -2.72, exempt: -2.7, total: -5.42 });
  });
});
