import { describe, expect, it } from "vitest";

import { FEATURES } from "@/core/entitlements/features";
import { addonFeatureForClinicJob, addonFeaturesForClinicJob } from "@/core/entitlements/job-features";

describe("addonFeatureForClinicJob", () => {
  it("gates AI and bulk export jobs", () => {
    expect(addonFeatureForClinicJob("run_ai_task")).toBe(FEATURES.AI);
    expect(addonFeatureForClinicJob("export_clinical_bulk")).toBe(FEATURES.DATA_EXPORT);
  });

  it("does not gate imports, email reminders, or operational reports", () => {
    expect(addonFeatureForClinicJob("import_patients_batch")).toBeNull();
    expect(addonFeatureForClinicJob("import_hce_batch")).toBeNull();
    expect(addonFeatureForClinicJob("generate_report")).toBeNull();
    expect(addonFeatureForClinicJob("send_email")).toBeNull();
    expect(addonFeatureForClinicJob("send_reminder")).toBeNull();
    expect(addonFeatureForClinicJob("send_reminder", { channel: "email" })).toBeNull();
  });

  it("gates WhatsApp reminder enqueue", () => {
    expect(addonFeatureForClinicJob("send_reminder", { channel: "whatsapp" })).toBe(
      FEATURES.WHATSAPP_REMINDERS
    );
  });
});

describe("addonFeaturesForClinicJob", () => {
  it("requires AI plus the task extra for run_ai_task", () => {
    expect(addonFeaturesForClinicJob("run_ai_task", { task: "clinical_summary" })).toEqual([
      FEATURES.AI,
      FEATURES.AI_CLINICAL_SUMMARY,
    ]);
    expect(addonFeaturesForClinicJob("run_ai_task", { task: "proactive_followup" })).toEqual([
      FEATURES.AI,
      FEATURES.AUTOMATION,
      FEATURES.AUTOMATION_FOLLOW_UP,
    ]);
    expect(addonFeaturesForClinicJob("run_ai_task")).toEqual([FEATURES.AI]);
  });

  it("does not add extras for operational jobs", () => {
    expect(addonFeaturesForClinicJob("generate_report")).toEqual([]);
    expect(addonFeaturesForClinicJob("send_email")).toEqual([]);
    expect(addonFeaturesForClinicJob("send_reminder", { channel: "whatsapp" })).toEqual([
      FEATURES.WHATSAPP,
      FEATURES.WHATSAPP_REMINDERS,
    ]);
  });
});
