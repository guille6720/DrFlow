import "server-only";

import { cache } from "react";

import { canUseFeatureAsSystem } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { createClient } from "@/core/supabase/server";

import { LAMEJOR_DEMO_CLINIC_ID } from "@/lib/utils/appointment";

export function isLaMejorDemoPortalSlug(slug: string): boolean {
  return process.env.APP_ENV === "fiscalization" && slug === "nexclinic-demo-medica-15d";
}

// The install page only needs the demo's public name. Keep public booking and
// anonymous access to the clinics table on their existing permission checks.
export const getLaMejorDemoPublicPortal = cache(async (slug: string) => {
  if (!isLaMejorDemoPortalSlug(slug) || !hasAdminClient()) return null;

  const { data } = await createAdminClient()
    .from("clinics")
    .select("id, name, trial_ends_at")
    .eq("id", LAMEJOR_DEMO_CLINIC_ID)
    .eq("slug", slug)
    .eq("is_fiscalization", true)
    .eq("is_active", true)
    .gt("trial_ends_at", new Date().toISOString())
    .maybeSingle();

  return data;
});

export async function getLaMejorDemoBookingProfessionals(clinicId: string) {
  const admin = createAdminClient();
  const { data: flag } = await admin.from("clinic_feature_flags")
    .select("enabled").eq("clinic_id", clinicId).eq("flag_id", "public_booking_online").maybeSingle();
  if (!flag?.enabled) return [];

  const { data } = await admin.from("professionals")
    .select("id, display_name").eq("clinic_id", clinicId).eq("is_active", true)
    .or("id.eq.db2d20bb-1671-4fc3-b564-a6960a6d1e74,and(user_id.is.null,license_number.in.(DEMO-1,DEMO-2,DEMO-3,DEMO-4,DEMO-5))")
    .order("display_name");

  return data ?? [];
}

export async function clinicIdForPublicSlug(slug: string): Promise<string | null> {
  if (isLaMejorDemoPortalSlug(slug)) {
    return (await getLaMejorDemoPublicPortal(slug))?.id ?? null;
  }
  const supabase = await createClient();
  const { data: link } = await supabase
    .from("public_booking_links")
    .select("clinic_id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (link?.clinic_id) return link.clinic_id;

  const { data: clinic } = await supabase.from("clinics").select("id").eq("slug", slug).maybeSingle();
  return clinic?.id ?? null;
}

export async function isPublicPortalAllowedForClinic(clinicId: string): Promise<boolean> {
  return canUseFeatureAsSystem({ clinicId, featureKey: FEATURES.PORTAL });
}

export async function isPublicPortalAllowedForSlug(slug: string): Promise<boolean> {
  const clinicId = await clinicIdForPublicSlug(slug);
  if (!clinicId) return false;
  return isPublicPortalAllowedForClinic(clinicId);
}
