import { describe, expect, it } from "vitest";

import {
  commercialStatusLabel,
  isMeteredBlockedByCommercialStatus,
  isSuspendedCommercialStatus,
} from "@/core/entitlements/commercial-status";

describe("isSuspendedCommercialStatus", () => {
  it("treats past_due cancelled and expired as suspended", () => {
    expect(isSuspendedCommercialStatus("past_due")).toBe(true);
    expect(isSuspendedCommercialStatus("cancelled")).toBe(true);
    expect(isSuspendedCommercialStatus("expired")).toBe(true);
  });

  it("keeps trialing and active usable", () => {
    expect(isSuspendedCommercialStatus("trialing")).toBe(false);
    expect(isSuspendedCommercialStatus("active")).toBe(false);
    expect(isSuspendedCommercialStatus(null)).toBe(false);
  });

  it("labels suspended statuses in Spanish", () => {
    expect(commercialStatusLabel("past_due")).toBe("vencido");
    expect(commercialStatusLabel("cancelled")).toBe("cancelado");
    expect(commercialStatusLabel("expired")).toBe("expirado");
    expect(commercialStatusLabel("active")).toBeNull();
  });

  it("blocks metered usage on suspended plan source but not override", () => {
    expect(isMeteredBlockedByCommercialStatus("past_due", "plan")).toBe(true);
    expect(isMeteredBlockedByCommercialStatus("past_due", "override")).toBe(false);
    expect(isMeteredBlockedByCommercialStatus("active", "plan")).toBe(false);
  });

  it("treats a lapsed commercial trial as suspended", () => {
    const now = new Date("2026-08-19T20:00:00.000Z");
    expect(isSuspendedCommercialStatus("trialing", "2026-01-01T00:00:00.000Z", now)).toBe(true);
    expect(isSuspendedCommercialStatus("trialing", null, now)).toBe(false);
    expect(commercialStatusLabel("expired")).toBe("expirado");
  });
});
