import { addonFeaturesForClinicalAiTask } from "@/core/entitlements/clinical-ai-features";
import { type FeatureKey, FEATURES } from "@/core/entitlements/features";

/** Import jobs stay ungated. Operational CSV reports are core (reports.basic). Email reminders stay ungated.
 *  automations.max_active applies only to WhatsApp reminder jobs and proactive_followup (see automation-jobs.ts). */
export function addonFeatureForClinicJob(
  jobType: string,
  payload?: Record<string, unknown> | null
): FeatureKey | null {
  if (jobType === "run_ai_task") return FEATURES.AI;
  if (jobType === "export_clinical_bulk") return FEATURES.DATA_EXPORT;
  if (jobType === "send_reminder" && payload?.channel === "whatsapp") {
    return FEATURES.WHATSAPP_REMINDERS;
  }
  return null;
}

/** All add-ons required to enqueue. `run_ai_task` also needs the task extra (summary / follow-up). */
export function addonFeaturesForClinicJob(
  jobType: string,
  payload?: Record<string, unknown> | null
): FeatureKey[] {
  if (jobType === "send_reminder" && payload?.channel === "whatsapp") {
    return [FEATURES.WHATSAPP, FEATURES.WHATSAPP_REMINDERS];
  }
  const primary = addonFeatureForClinicJob(jobType, payload);
  if (jobType === "run_ai_task") {
    const task = typeof payload?.task === "string" ? payload.task : "";
    const extras = task ? addonFeaturesForClinicalAiTask(task) : [];
    const keys: FeatureKey[] = [FEATURES.AI];
    for (const extra of extras) {
      if (extra !== FEATURES.AI && !keys.includes(extra)) keys.push(extra);
    }
    return keys;
  }
  return primary ? [primary] : [];
}
