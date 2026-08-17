import {
  clinicClinicalTemplatesTag,
  clinicCoverageRulesTag,
  clinicFeatureFlagsTag,
  clinicLocationsTag,
  clinicPamiPlanillasTag,
  clinicPluginsTag,
  clinicPortalTag,
  clinicProfessionalsTag,
  clinicSettingsTag,
  clinicSpecialtiesTag,
} from "@/core/cache/cache-tags";
import type { ProfessionalAgendaRow, ProfessionalListRow, SettingsProfessionalRow } from "@/core/supabase/query-types";
import {
  CLINICAL_TEMPLATE_COLUMNS,
  PROFESSIONAL_AGENDA_COLUMNS,
  PROFESSIONAL_PRESCRIBER_COLUMNS,
} from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";

import {
  CLINIC_METADATA_TTL,
  withClinicMetadataCache,
} from "@/lib/server/clinic-metadata-unstable-cache";
import { loadClinicFeatureFlags } from "@/lib/server/load-clinic-feature-flags";
import { loadClinicPlugins } from "@/lib/server/load-clinic-plugins";
import { resolveProfessionalSignatureUrls } from "@/lib/server/resolve-professional-signature-urls";
import { fetchPortalContext, type PortalContext } from "@/lib/utils/portal-doctor-info";

export type ClinicSettingsRow = {
  default_appointment_duration: number | null;
  timezone: string | null;
  doctors_can_access_cash: boolean | null;
  voice_input_enabled: boolean | null;
  accepted_coverages: string[] | null;
};

const CLINICAL_TEMPLATE_ADMIN_COLUMNS = `${CLINICAL_TEMPLATE_COLUMNS}, specialty_id, is_active`;

/** Session client signs URLs after cross-request DB cache (URLs expire; paths are cached). */
async function signProfessionalRows<T extends { signature_image_path?: string | null }>(
  rows: T[]
): Promise<Array<T & { signature_image_url: string | null }>> {
  const supabase = await createClient();
  return resolveProfessionalSignatureUrls(supabase, rows);
}

export async function loadClinicPluginsCached(clinicId: string) {
  return withClinicMetadataCache(
    {
      key: "plugins",
      clinicId,
      tag: clinicPluginsTag(clinicId),
      revalidate: CLINIC_METADATA_TTL.plugins,
    },
    (supabase) => loadClinicPlugins(supabase, clinicId)
  );
}

export async function loadClinicFeatureFlagsCached(clinicId: string) {
  return withClinicMetadataCache(
    {
      key: "feature-flags",
      clinicId,
      tag: clinicFeatureFlagsTag(clinicId),
      revalidate: CLINIC_METADATA_TTL.featureFlags,
    },
    (supabase) => loadClinicFeatureFlags(supabase, clinicId)
  );
}

export async function loadClinicPortalContextCached(clinicId: string): Promise<PortalContext> {
  return withClinicMetadataCache(
    {
      key: "portal",
      clinicId,
      tag: clinicPortalTag(clinicId),
      revalidate: CLINIC_METADATA_TTL.portal,
    },
    (supabase) => fetchPortalContext(clinicId, supabase)
  );
}

export async function loadClinicSettingsCached(clinicId: string): Promise<ClinicSettingsRow | null> {
  return withClinicMetadataCache(
    {
      key: "settings",
      clinicId,
      tag: clinicSettingsTag(clinicId),
      revalidate: CLINIC_METADATA_TTL.clinicSettings,
    },
    async (supabase) => {
      const { data } = await supabase
        .from("clinics")
        .select(
          "default_appointment_duration, timezone, doctors_can_access_cash, voice_input_enabled, accepted_coverages"
        )
        .eq("id", clinicId)
        .maybeSingle();
      return (data as ClinicSettingsRow | null) ?? null;
    }
  );
}

export async function loadClinicProfessionalsAgendaCached(clinicId: string): Promise<ProfessionalAgendaRow[]> {
  return withClinicMetadataCache(
    {
      key: "professionals-agenda",
      clinicId,
      tag: clinicProfessionalsTag(clinicId),
      revalidate: CLINIC_METADATA_TTL.professionals,
    },
    async (supabase) => {
      const { data } = await supabase
        .from("professionals")
        .select(`${PROFESSIONAL_AGENDA_COLUMNS}, profiles(full_name), specialties(name)`)
        .eq("clinic_id", clinicId)
        .eq("is_active", true);
      return data ?? [];
    }
  );
}

export async function loadClinicProfessionalsSettingsCached(clinicId: string): Promise<SettingsProfessionalRow[]> {
  return withClinicMetadataCache(
    {
      key: "professionals-settings",
      clinicId,
      tag: clinicProfessionalsTag(clinicId),
      revalidate: CLINIC_METADATA_TTL.professionals,
    },
    async (supabase) => {
      const { data } = await supabase
        .from("professionals")
        .select("id, display_name, license_number, profiles(full_name), specialties(name)")
        .eq("clinic_id", clinicId)
        .order("display_name");
      return data ?? [];
    }
  );
}

export async function loadClinicProfessionalsListRowsCached(clinicId: string): Promise<ProfessionalListRow[]> {
  return withClinicMetadataCache(
    {
      key: "professionals-list",
      clinicId,
      tag: clinicProfessionalsTag(clinicId),
      revalidate: CLINIC_METADATA_TTL.professionals,
    },
    async (supabase) => {
      const { data } = await supabase
        .from("professionals")
        .select(
          "id, display_name, license_number, license_national, license_provincial, signature_text, signature_image_path, profiles(full_name)"
        )
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("display_name");
      return data ?? [];
    }
  );
}

export async function loadClinicProfessionalsListCached(clinicId: string) {
  const rows = await loadClinicProfessionalsListRowsCached(clinicId);
  return signProfessionalRows(rows);
}

export async function loadClinicProfessionalsFullRowsCached(clinicId: string) {
  return withClinicMetadataCache(
    {
      key: "professionals-full",
      clinicId,
      tag: clinicProfessionalsTag(clinicId),
      revalidate: CLINIC_METADATA_TTL.professionals,
    },
    async (supabase) => {
      const { data } = await supabase
        .from("professionals")
        .select(PROFESSIONAL_PRESCRIBER_COLUMNS)
        .eq("clinic_id", clinicId)
        .eq("is_active", true);
      return data ?? [];
    }
  );
}

export async function loadClinicProfessionalsFullCached(clinicId: string) {
  const rows = await loadClinicProfessionalsFullRowsCached(clinicId);
  return signProfessionalRows(rows);
}

export async function loadClinicLocationsCached(clinicId: string) {
  return withClinicMetadataCache(
    {
      key: "locations",
      clinicId,
      tag: clinicLocationsTag(clinicId),
      revalidate: CLINIC_METADATA_TTL.locations,
    },
    async (supabase) => {
      const { data } = await supabase
        .from("locations")
        .select("id, name, address, phone, is_active")
        .eq("clinic_id", clinicId)
        .order("name");
      return data ?? [];
    }
  );
}

export async function loadClinicSpecialtiesCached(clinicId: string) {
  return withClinicMetadataCache(
    {
      key: "specialties",
      clinicId,
      tag: clinicSpecialtiesTag(clinicId),
      revalidate: CLINIC_METADATA_TTL.specialties,
    },
    async (supabase) => {
      const { data } = await supabase
        .from("specialties")
        .select("id, name")
        .eq("clinic_id", clinicId);
      return data ?? [];
    }
  );
}

export async function loadClinicClinicalTemplatesCached(clinicId: string) {
  return withClinicMetadataCache(
    {
      key: "clinical-templates-active",
      clinicId,
      tag: clinicClinicalTemplatesTag(clinicId),
      revalidate: CLINIC_METADATA_TTL.clinicalTemplates,
    },
    async (supabase) => {
      const { data } = await supabase
        .from("clinical_templates")
        .select(CLINICAL_TEMPLATE_COLUMNS)
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    }
  );
}

/** Admin plantillas page — includes inactive rows; same invalidation tag. */
export async function loadClinicClinicalTemplatesAdminCached(clinicId: string) {
  return withClinicMetadataCache(
    {
      key: "clinical-templates-all",
      clinicId,
      tag: clinicClinicalTemplatesTag(clinicId),
      revalidate: CLINIC_METADATA_TTL.clinicalTemplates,
    },
    async (supabase) => {
      const { data } = await supabase
        .from("clinical_templates")
        .select(CLINICAL_TEMPLATE_ADMIN_COLUMNS)
        .eq("clinic_id", clinicId)
        .order("name");
      return data ?? [];
    }
  );
}

export async function loadPamiPlanillaCatalogCached(clinicId: string) {
  return withClinicMetadataCache(
    {
      key: "pami-planillas",
      clinicId,
      tag: clinicPamiPlanillasTag(clinicId),
      revalidate: CLINIC_METADATA_TTL.pamiPlanillas,
    },
    async (supabase) => {
      const { loadPamiPlanillaCatalog } = await import(
        "@/features/pami/services/pami-planilla-templates.service"
      );
      return loadPamiPlanillaCatalog(supabase, clinicId);
    }
  );
}

/** Clinic-level prescription coverage overrides — not PHI. */
export async function loadClinicCoverageRulesCached(clinicId: string) {
  return withClinicMetadataCache(
    {
      key: "coverage-rules",
      clinicId,
      tag: clinicCoverageRulesTag(clinicId),
      revalidate: CLINIC_METADATA_TTL.coverageRules,
    },
    async (supabase) => {
      const { data } = await supabase
        .from("coverage_rules")
        .select("id, coverage_kind, rules, active")
        .eq("clinic_id", clinicId)
        .eq("active", true);
      return data ?? [];
    }
  );
}
