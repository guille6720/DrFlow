import { describe, expect, it } from "vitest";

import { FEATURES } from "@/core/entitlements/features";
import {
  addonFeatureForClinicFeatureFlag,
  isFlagEntitledBySnapshot,
} from "@/core/entitlements/flag-features";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";

describe("addonFeatureForClinicFeatureFlag", () => {
  it("maps IA, WhatsApp reminders and public booking flags", () => {
    expect(addonFeatureForClinicFeatureFlag("consultation_assistant")).toBe(FEATURES.AI);
    expect(addonFeatureForClinicFeatureFlag("admin_ops_assistant")).toBe(FEATURES.AI);
    expect(addonFeatureForClinicFeatureFlag("recordatorios")).toBe(FEATURES.WHATSAPP_REMINDERS);
    expect(addonFeatureForClinicFeatureFlag("public_booking_online")).toBe(FEATURES.PORTAL);
  });

  it("does not gate core UX flags", () => {
    expect(addonFeatureForClinicFeatureFlag("command_palette")).toBeNull();
    expect(addonFeatureForClinicFeatureFlag("floating_actions")).toBeNull();
    expect(addonFeatureForClinicFeatureFlag("clinical_timeline")).toBeNull();
    expect(addonFeatureForClinicFeatureFlag("patient_audit_tab")).toBeNull();
  });
});

describe("isFlagEntitledBySnapshot", () => {
  const snapshot: ClientEntitlementsSnapshot = {
    catalogAvailable: true,
    planKey: "basic",
    status: "active",
    allowed: { [FEATURES.AI]: false, [FEATURES.WHATSAPP_REMINDERS]: true },
    usage: {},
    limits: {},
  };

  it("fails open when the catalog is missing", () => {
    expect(isFlagEntitledBySnapshot("consultation_assistant", null)).toBe(true);
    expect(
      isFlagEntitledBySnapshot("consultation_assistant", { ...snapshot, catalogAvailable: false })
    ).toBe(true);
  });

  it("hides IA flags when the plan does not include AI", () => {
    expect(isFlagEntitledBySnapshot("consultation_assistant", snapshot)).toBe(false);
    expect(isFlagEntitledBySnapshot("recordatorios", snapshot)).toBe(true);
    expect(isFlagEntitledBySnapshot("command_palette", snapshot)).toBe(true);
  });
});
