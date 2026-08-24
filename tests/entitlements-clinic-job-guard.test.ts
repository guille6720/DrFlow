import { describe, expect, it } from "vitest";

import { ADMIN_OVERRIDE_FEATURE_KEYS } from "@/core/entitlements/admin-constants";
import { countsTowardAutomationsMaxActive } from "@/core/entitlements/automation-jobs";
import { LIMIT_FEATURES } from "@/core/entitlements/features";

describe("assertClinicJobEnqueueAllowed contract", () => {
  it("only automation-like jobs consume automations.max_active", () => {
    expect(countsTowardAutomationsMaxActive("send_reminder", { channel: "whatsapp" })).toBe(true);
    expect(countsTowardAutomationsMaxActive("run_ai_task", { task: "proactive_followup" })).toBe(
      true
    );
    expect(countsTowardAutomationsMaxActive("run_ai_task", { task: "clinical_summary" })).toBe(
      false
    );
    expect(countsTowardAutomationsMaxActive("export_clinical_bulk")).toBe(false);
  });
});

describe("superadmin override catalog parity", () => {
  it("includes every limit feature from migration 121", () => {
    for (const key of LIMIT_FEATURES) {
      expect(ADMIN_OVERRIDE_FEATURE_KEYS).toContain(key);
    }
  });
});
