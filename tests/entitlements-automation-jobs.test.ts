import { describe, expect, it } from "vitest";

import {
  countsTowardAutomationsMaxActive,
  isAutomationLikeClinicJobRow,
} from "@/core/entitlements/automation-jobs";
import { FEATURES } from "@/core/entitlements/features";
import { decideSeatCapacity } from "@/core/entitlements/limits";

describe("countsTowardAutomationsMaxActive", () => {
  it("counts WhatsApp reminder jobs and proactive follow-up only", () => {
    expect(countsTowardAutomationsMaxActive("send_reminder", { channel: "whatsapp" })).toBe(true);
    expect(countsTowardAutomationsMaxActive("run_ai_task", { task: "proactive_followup" })).toBe(
      true
    );
  });

  it("does not count imports, reports, email reminders, or other AI tasks", () => {
    expect(countsTowardAutomationsMaxActive("import_patients_batch")).toBe(false);
    expect(countsTowardAutomationsMaxActive("generate_report")).toBe(false);
    expect(countsTowardAutomationsMaxActive("send_reminder", { channel: "email" })).toBe(false);
    expect(countsTowardAutomationsMaxActive("run_ai_task", { task: "clinical_summary" })).toBe(
      false
    );
    expect(countsTowardAutomationsMaxActive("export_clinical_bulk")).toBe(false);
  });

  it("filters clinic job rows", () => {
    expect(
      isAutomationLikeClinicJobRow({
        job_type: "send_reminder",
        payload: { channel: "whatsapp" },
      })
    ).toBe(true);
    expect(
      isAutomationLikeClinicJobRow({
        job_type: "send_reminder",
        payload: { channel: "email" },
      })
    ).toBe(false);
  });
});

describe("automations.max_active capacity", () => {
  it("fails open when the catalog is missing", () => {
    expect(
      decideSeatCapacity({
        enforced: true,
        catalogAvailable: false,
        limit: 0,
        currentCount: 99,
        featureKey: FEATURES.AUTOMATIONS_MAX_ACTIVE,
      })
    ).toEqual({ ok: true });
  });

  it("blocks when basic/pro cap is zero", () => {
    const denied = decideSeatCapacity({
      enforced: true,
      catalogAvailable: true,
      limit: 0,
      currentCount: 0,
      featureKey: FEATURES.AUTOMATIONS_MAX_ACTIVE,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error).toMatch(/automatizaciones activas/);
    }
  });

  it("allows the last premium slot", () => {
    expect(
      decideSeatCapacity({
        enforced: true,
        catalogAvailable: true,
        limit: 20,
        currentCount: 19,
        featureKey: FEATURES.AUTOMATIONS_MAX_ACTIVE,
      })
    ).toEqual({ ok: true });
  });
});
