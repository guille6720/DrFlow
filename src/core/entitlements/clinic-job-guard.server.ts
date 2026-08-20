import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertAutomationJobCapacity } from "@/core/entitlements/automation-jobs.server";
import { requireAddonFeatureAccess } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import { addonFeaturesForClinicJob } from "@/core/entitlements/job-features";

/** Session-scoped guard before inserting into clinic_jobs. Imports stay ungated. */
export async function assertClinicJobEnqueueAllowed(args: {
  clinicId: string;
  jobType: string;
  payload?: Record<string, unknown> | null;
  supabase?: SupabaseClient;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const addon of addonFeaturesForClinicJob(args.jobType, args.payload)) {
    const entitlement = await requireAddonFeatureAccess(addon);
    if (!entitlement.ok) return entitlement;
  }

  return assertAutomationJobCapacity({
    clinicId: args.clinicId,
    jobType: args.jobType,
    payload: args.payload,
    supabase: args.supabase,
  });
}

/** Sync WhatsApp reminders (no job row) still honor base WhatsApp + automation slot. */
export async function assertWhatsAppReminderSendAllowed(args: {
  clinicId: string;
  supabase: SupabaseClient;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const featureKey of [FEATURES.WHATSAPP, FEATURES.WHATSAPP_REMINDERS] as const) {
    const entitlement = await requireAddonFeatureAccess(featureKey);
    if (!entitlement.ok) return entitlement;
  }

  return assertAutomationJobCapacity({
    clinicId: args.clinicId,
    jobType: "send_reminder",
    payload: { channel: "whatsapp" },
    supabase: args.supabase,
  });
}
