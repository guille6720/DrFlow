import { describe, expect, it } from "vitest";

import {
  addonFeatureForClinicalAiTask,
  addonFeaturesForClinicalAiTask,
} from "@/core/entitlements/clinical-ai-features";
import { FEATURES } from "@/core/entitlements/features";

describe("addonFeatureForClinicalAiTask", () => {
  it("maps summary-style tasks to ai.clinical_summary", () => {
    expect(addonFeatureForClinicalAiTask("clinical_summary")).toBe(FEATURES.AI_CLINICAL_SUMMARY);
    expect(addonFeatureForClinicalAiTask("soap_draft")).toBe(FEATURES.AI_CLINICAL_SUMMARY);
    expect(addonFeatureForClinicalAiTask("pre_visit_brief")).toBe(FEATURES.AI_CLINICAL_SUMMARY);
  });

  it("maps documentation to ai.document_generation", () => {
    expect(addonFeatureForClinicalAiTask("consultation_documentation")).toBe(
      FEATURES.AI_DOCUMENT_GENERATION
    );
  });

  it("leaves copilot on ai.enabled only", () => {
    expect(addonFeatureForClinicalAiTask("copilot_query")).toBeNull();
    expect(addonFeatureForClinicalAiTask("lab_interpretation")).toBeNull();
  });

  it("maps follow-up to automations.follow_up", () => {
    expect(addonFeatureForClinicalAiTask("proactive_followup")).toBe(FEATURES.AUTOMATION_FOLLOW_UP);
  });

  it("requires automation.enabled plus follow-up for proactive_followup", () => {
    expect(addonFeaturesForClinicalAiTask("proactive_followup")).toEqual([
      FEATURES.AUTOMATION,
      FEATURES.AUTOMATION_FOLLOW_UP,
    ]);
    expect(addonFeaturesForClinicalAiTask("clinical_summary")).toEqual([FEATURES.AI_CLINICAL_SUMMARY]);
    expect(addonFeaturesForClinicalAiTask("copilot_query")).toEqual([]);
  });
});
