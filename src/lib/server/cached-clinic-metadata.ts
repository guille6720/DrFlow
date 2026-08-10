import type { ProfessionalAgendaRow, ProfessionalListRow, SettingsProfessionalRow } from "@/core/supabase/query-types";
import {
  CLINICAL_TEMPLATE_COLUMNS,
  PROFESSIONAL_AGENDA_COLUMNS,
  PROFESSIONAL_PRESCRIBER_COLUMNS,
} from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";

import { loadClinicFeatureFlags } from "@/lib/server/load-clinic-feature-flags";
import { loadClinicPlugins } from "@/lib/server/load-clinic-plugins";
import { resolveProfessionalSignatureUrls } from "@/lib/server/resolve-professional-signature-urls";
import { fetchPortalContext, type PortalContext } from "@/lib/utils/portal-doctor-info";

/**
 * Clinic-scoped reads use the request Supabase client (cookies/session).
 * Do not wrap these in unstable_cache — Next.js forbids cookies() inside cache scopes.
 * Per-request dedupe lives in cached-clinic-queries.ts (React.cache).
 */

export async function loadClinicPluginsCached(clinicId: string) {
  const supabase = await createClient();
  return loadClinicPlugins(supabase, clinicId);
}

export async function loadClinicFeatureFlagsCached(clinicId: string) {
  const supabase = await createClient();
  return loadClinicFeatureFlags(supabase, clinicId);
}

export async function loadClinicPortalContextCached(clinicId: string): Promise<PortalContext> {
  const supabase = await createClient();
  return fetchPortalContext(clinicId, supabase);
}

export async function loadClinicProfessionalsAgendaCached(clinicId: string): Promise<ProfessionalAgendaRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("professionals")
    .select(`${PROFESSIONAL_AGENDA_COLUMNS}, profiles(full_name), specialties(name)`)
    .eq("clinic_id", clinicId)
    .eq("is_active", true);
  return data ?? [];
}

export async function loadClinicProfessionalsSettingsCached(clinicId: string): Promise<SettingsProfessionalRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("professionals")
    .select("id, display_name, license_number, profiles(full_name), specialties(name)")
    .eq("clinic_id", clinicId)
    .order("display_name");
  return data ?? [];
}

export async function loadClinicProfessionalsListCached(clinicId: string): Promise<ProfessionalListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("professionals")
    .select(
      "id, display_name, license_number, license_national, license_provincial, signature_text, signature_image_path, profiles(full_name)"
    )
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("display_name");
  return resolveProfessionalSignatureUrls(supabase, data ?? []);
}

export async function loadClinicProfessionalsFullCached(clinicId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("professionals")
    .select(PROFESSIONAL_PRESCRIBER_COLUMNS)
    .eq("clinic_id", clinicId)
    .eq("is_active", true);
  return resolveProfessionalSignatureUrls(supabase, data ?? []);
}

export async function loadClinicLocationsCached(clinicId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("locations")
    .select("id, name")
    .eq("clinic_id", clinicId);
  return data ?? [];
}

export async function loadClinicSpecialtiesCached(clinicId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("specialties")
    .select("id, name")
    .eq("clinic_id", clinicId);
  return data ?? [];
}

export async function loadClinicClinicalTemplatesCached(clinicId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinical_templates")
    .select(CLINICAL_TEMPLATE_COLUMNS)
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}

export async function loadPamiPlanillaCatalogCached(clinicId: string) {
  const supabase = await createClient();
  const { loadPamiPlanillaCatalog } = await import(
    "@/features/pami/services/pami-planilla-templates.service"
  );
  return loadPamiPlanillaCatalog(supabase, clinicId);
}
