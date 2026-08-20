import { type FeatureKey, FEATURES } from "@/core/entitlements/features";

const SUMMARY_TASKS = new Set([
  "clinical_summary",
  "pre_visit_brief",
  "soap_draft",
  "close_encounter",
]);

/** Extra boolean on top of ai.enabled. Copilot/query stays on ai.enabled only. */
export function addonFeatureForClinicalAiTask(task: string): FeatureKey | null {
  if (SUMMARY_TASKS.has(task)) return FEATURES.AI_CLINICAL_SUMMARY;
  if (task === "consultation_documentation") return FEATURES.AI_DOCUMENT_GENERATION;
  if (task === "proactive_followup") return FEATURES.AUTOMATION_FOLLOW_UP;
  return null;
}

/** Follow-up also needs automation.enabled. Other extras stay a single key. */
export function addonFeaturesForClinicalAiTask(task: string): FeatureKey[] {
  if (task === "proactive_followup") {
    return [FEATURES.AUTOMATION, FEATURES.AUTOMATION_FOLLOW_UP];
  }
  const extra = addonFeatureForClinicalAiTask(task);
  return extra ? [extra] : [];
}
