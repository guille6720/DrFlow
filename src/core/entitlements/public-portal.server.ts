import "server-only";

import { canUseFeatureAsSystem } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import { createClient } from "@/core/supabase/server";

export async function clinicIdForPublicSlug(slug: string): Promise<string | null> {
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
