import { unstable_cache } from "next/cache";

import {
  clinicClinicalTemplatesTag,
  clinicFeatureFlagsTag,
  clinicLocationsTag,
  clinicPluginsTag,
  clinicPortalTag,
  clinicProfessionalsTag,
  clinicSpecialtiesTag,
} from "@/core/cache/cache-tags";
import {
  CLINICAL_TEMPLATE_COLUMNS,
  PROFESSIONAL_AGENDA_COLUMNS,
} from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";

import { loadClinicFeatureFlags } from "@/lib/server/load-clinic-feature-flags";
import { loadClinicPlugins } from "@/lib/server/load-clinic-plugins";
import { fetchPortalContext, type PortalContext } from "@/lib/utils/portal-doctor-info";

/** Semi-static clinic plugin rows — TTL 2 min, invalidated on toggle. */
export function loadClinicPluginsCached(clinicId: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient();
      return loadClinicPlugins(supabase, clinicId);
    },
    ["clinic-plugins", clinicId],
    { revalidate: 120, tags: [clinicPluginsTag(clinicId)] }
  )();
}

/** Semi-static feature flags — TTL 2 min, invalidated on toggle. */
export function loadClinicFeatureFlagsCached(clinicId: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient();
      return loadClinicFeatureFlags(supabase, clinicId);
    },
    ["clinic-feature-flags", clinicId],
    { revalidate: 120, tags: [clinicFeatureFlagsTag(clinicId)] }
  )();
}

/** Portal slug + doctor share info — TTL 5 min, invalidated on booking/settings change. */
export function loadClinicPortalContextCached(clinicId: string): Promise<PortalContext> {
  return unstable_cache(
    async () => {
      const supabase = await createClient();
      return fetchPortalContext(clinicId, supabase);
    },
    ["clinic-portal-context", clinicId],
    { revalidate: 300, tags: [clinicPortalTag(clinicId)] }
  )();
}

/** Active professionals for agenda (richest select). TTL 5 min. */
export function loadClinicProfessionalsAgendaCached(clinicId: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient();
      const { data } = await supabase
        .from("professionals")
        .select(`${PROFESSIONAL_AGENDA_COLUMNS}, profiles(full_name), specialties(name)`)
        .eq("clinic_id", clinicId)
        .eq("is_active", true);
      return data ?? [];
    },
    ["clinic-professionals-agenda", clinicId],
    { revalidate: 300, tags: [clinicProfessionalsTag(clinicId)] }
  )();
}

/** Active professionals — settings panel (includes inactive). TTL 5 min. */
export function loadClinicProfessionalsSettingsCached(clinicId: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient();
      const { data } = await supabase
        .from("professionals")
        .select("id, display_name, license_number, profiles(full_name), specialties(name)")
        .eq("clinic_id", clinicId)
        .order("display_name");
      return data ?? [];
    },
    ["clinic-professionals-settings", clinicId],
    { revalidate: 300, tags: [clinicProfessionalsTag(clinicId)] }
  )();
}

/** Active professionals — standard list for forms/workspace. TTL 5 min. */
export function loadClinicProfessionalsListCached(clinicId: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient();
      const { data } = await supabase
        .from("professionals")
        .select("id, display_name, license_number, profiles(full_name)")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("display_name");
      return data ?? [];
    },
    ["clinic-professionals-list", clinicId],
    { revalidate: 300, tags: [clinicProfessionalsTag(clinicId)] }
  )();
}

/** Active professionals — full row for recetas hub. TTL 5 min. */
export function loadClinicProfessionalsFullCached(clinicId: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient();
      const { data } = await supabase
        .from("professionals")
        .select("*, profiles(full_name), specialties(name)")
        .eq("clinic_id", clinicId)
        .eq("is_active", true);
      return data ?? [];
    },
    ["clinic-professionals-full", clinicId],
    { revalidate: 300, tags: [clinicProfessionalsTag(clinicId)] }
  )();
}

/** Clinic locations — TTL 10 min. */
export function loadClinicLocationsCached(clinicId: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient();
      const { data } = await supabase
        .from("locations")
        .select("id, name")
        .eq("clinic_id", clinicId);
      return data ?? [];
    },
    ["clinic-locations", clinicId],
    { revalidate: 600, tags: [clinicLocationsTag(clinicId)] }
  )();
}

/** Clinic specialties — TTL 10 min. */
export function loadClinicSpecialtiesCached(clinicId: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient();
      const { data } = await supabase
        .from("specialties")
        .select("id, name")
        .eq("clinic_id", clinicId);
      return data ?? [];
    },
    ["clinic-specialties", clinicId],
    { revalidate: 600, tags: [clinicSpecialtiesTag(clinicId)] }
  )();
}

/** SOAP clinical templates — TTL 10 min. */
export function loadClinicClinicalTemplatesCached(clinicId: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient();
      const { data } = await supabase
        .from("clinical_templates")
        .select(CLINICAL_TEMPLATE_COLUMNS)
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
    ["clinic-clinical-templates", clinicId],
    { revalidate: 600, tags: [clinicClinicalTemplatesTag(clinicId)] }
  )();
}
