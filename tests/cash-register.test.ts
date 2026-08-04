import { describe, it, expect } from "vitest";
import {
  CASH_CHARGE_KINDS,
  isBlockedChargeKind,
  labelForAttentionType,
  labelForChargeKind,
  labelForPaymentMethod,
  labelForWaitingRoom,
} from "@/lib/constants/cash-register";

describe("Cash register catalogs", () => {
  it("does not include PLUS as charge kind", () => {
    const labels = CASH_CHARGE_KINDS.map((c) => c.label.toLowerCase());
    expect(labels.some((l) => l.includes("plus"))).toBe(false);
    expect(isBlockedChargeKind("PLUS")).toBe(true);
    expect(isBlockedChargeKind("Consulta Particular")).toBe(false);
  });

  it("resolves label helpers", () => {
    expect(labelForChargeKind("consulta_particular")).toBe("Consulta Particular");
    expect(labelForPaymentMethod("cash")).toBe("Efectivo");
    expect(labelForAttentionType("particular")).toBe("Particular");
    expect(labelForWaitingRoom("waiting")).toBe("Esperando");
    expect(labelForChargeKind("unknown_code")).toBe("unknown_code");
  });
});
