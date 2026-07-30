import { describe, it, expect } from "vitest";
import {
  CASH_CHARGE_KINDS,
  isBlockedChargeKind,
} from "@/lib/constants/cash-register";

describe("Cash register catalogs", () => {
  it("does not include PLUS as charge kind", () => {
    const labels = CASH_CHARGE_KINDS.map((c) => c.label.toLowerCase());
    expect(labels.some((l) => l.includes("plus"))).toBe(false);
    expect(isBlockedChargeKind("PLUS")).toBe(true);
    expect(isBlockedChargeKind("Consulta Particular")).toBe(false);
  });
});
