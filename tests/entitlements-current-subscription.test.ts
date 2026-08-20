import { describe, expect, it } from "vitest";

import {
  effectiveCommercialStatus,
  isLapsedCommercialTrial,
  isLiveCommercialStatus,
  isMeteredBlockedByCommercialStatus,
  isSuspendedCommercialStatus,
  pickCurrentEntitlementSubscription,
} from "@/core/entitlements/commercial-status";

describe("pickCurrentEntitlementSubscription", () => {
  it("prefers live active over a newer past_due", () => {
    const current = pickCurrentEntitlementSubscription([
      { status: "past_due", createdAt: "2026-08-19T12:00:00.000Z" },
      { status: "active", createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(current?.status).toBe("active");
  });

  it("uses the latest suspended row when nothing is live", () => {
    const current = pickCurrentEntitlementSubscription([
      { status: "cancelled", createdAt: "2026-08-01T00:00:00.000Z" },
      { status: "past_due", createdAt: "2026-08-19T00:00:00.000Z" },
    ]);
    expect(current?.status).toBe("past_due");
  });

  it("uses the newest live row when several are live", () => {
    const current = pickCurrentEntitlementSubscription([
      { status: "active", createdAt: "2026-01-01T00:00:00.000Z" },
      { status: "trialing", createdAt: "2026-08-19T00:00:00.000Z" },
    ]);
    expect(current?.status).toBe("trialing");
  });
});

describe("isLiveCommercialStatus", () => {
  it("treats trialing and active as live", () => {
    expect(isLiveCommercialStatus("trialing")).toBe(true);
    expect(isLiveCommercialStatus("active")).toBe(true);
    expect(isLiveCommercialStatus("past_due")).toBe(false);
  });

  it("keeps trialing live when trial_ends_at is null", () => {
    expect(isLiveCommercialStatus("trialing", null)).toBe(true);
    expect(isLapsedCommercialTrial("trialing", null)).toBe(false);
  });

  it("treats trialing as expired when trial_ends_at has passed", () => {
    const now = new Date("2026-08-19T20:00:00.000Z");
    expect(isLiveCommercialStatus("trialing", "2026-08-01T00:00:00.000Z", now)).toBe(false);
    expect(isLapsedCommercialTrial("trialing", "2026-08-01T00:00:00.000Z", now)).toBe(true);
    expect(effectiveCommercialStatus("trialing", "2026-08-01T00:00:00.000Z", now)).toBe("expired");
    expect(isSuspendedCommercialStatus("trialing", "2026-08-01T00:00:00.000Z", now)).toBe(true);
    expect(
      isMeteredBlockedByCommercialStatus("trialing", "plan", "2026-08-01T00:00:00.000Z", now)
    ).toBe(true);
    expect(
      isMeteredBlockedByCommercialStatus("trialing", "override", "2026-08-01T00:00:00.000Z", now)
    ).toBe(false);
  });

  it("does not expire an active plan because of trial_ends_at", () => {
    const now = new Date("2026-08-19T20:00:00.000Z");
    expect(isLiveCommercialStatus("active", "2026-08-01T00:00:00.000Z", now)).toBe(true);
  });
});

describe("pickCurrentEntitlementSubscription trial window", () => {
  it("prefers a live active over a newer lapsed trial", () => {
    const now = new Date("2026-08-19T20:00:00.000Z");
    const current = pickCurrentEntitlementSubscription(
      [
        {
          status: "trialing",
          createdAt: "2026-08-19T12:00:00.000Z",
          trialEndsAt: "2026-08-01T00:00:00.000Z",
        },
        { status: "active", createdAt: "2026-01-01T00:00:00.000Z", trialEndsAt: null },
      ],
      now
    );
    expect(current?.status).toBe("active");
  });
});
