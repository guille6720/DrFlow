import { cache } from "react";

import {
  buildClinicFeaturesContext,
  type ClinicFeaturesContext,
  resolveClinicFeatureFlags,
  type ResolvedClinicFeatureFlags,
} from "@/features/flags/lib/resolve";

import {
  loadClinicClinicalTemplatesAdminCached,
  loadClinicClinicalTemplatesCached,
  loadClinicFeatureFlagsCached,
  loadClinicLocationsCached,
  loadClinicPluginsCached,
  loadClinicPortalContextCached,
  loadClinicProfessionalsAgendaCached,
  loadClinicProfessionalsFullCached,
  loadClinicProfessionalsListCached,
  loadClinicProfessionalsSettingsCached,
  loadClinicSettingsCached,
  loadClinicSpecialtiesCached,
  loadPamiPlanillaCatalogCached,
} from "@/lib/server/cached-clinic-metadata";
import type { PortalContext } from "@/lib/utils/portal-doctor-info";
import { resolveClinicPlugins } from "@/plugins/resolve";

/** Per-request dedupe + cross-request cache for clinic plugin rows. */
export const getCachedClinicPlugins = cache(async (clinicId: string) => {
  return loadClinicPluginsCached(clinicId);
});

/** Per-request dedupe + cross-request cache for clinic feature flag rows. */
export const getCachedClinicFeatureFlags = cache(
  async (clinicId: string): Promise<ResolvedClinicFeatureFlags> => {
    return loadClinicFeatureFlagsCached(clinicId);
  }
);

/** Plugins + flags merged — replaces duplicate layout + page fetches. */
export const getCachedClinicFeatures = cache(
  async (clinicId: string): Promise<ClinicFeaturesContext> => {
    const [plugins, flags] = await Promise.all([
      getCachedClinicPlugins(clinicId),
      getCachedClinicFeatureFlags(clinicId),
    ]);
    return buildClinicFeaturesContext(plugins, flags);
  }
);

/** Active public booking slug — derived from portal context (single query). */
export const getCachedActiveBookingSlug = cache(async (clinicId: string): Promise<string | null> => {
  const ctx = await getCachedPortalContext(clinicId);
  return ctx.portalSlug;
});

/** Portal slug + doctor share info — deduped across pacientes/historias/agenda loaders. */
export const getCachedPortalContext = cache(
  async (clinicId: string): Promise<PortalContext> => {
    return loadClinicPortalContextCached(clinicId);
  }
);

export const getCachedClinicProfessionalsAgenda = cache(async (clinicId: string) => {
  return loadClinicProfessionalsAgendaCached(clinicId);
});

export const getCachedClinicProfessionalsSettings = cache(async (clinicId: string) => {
  return loadClinicProfessionalsSettingsCached(clinicId);
});

export const getCachedClinicProfessionalsList = cache(async (clinicId: string) => {
  return loadClinicProfessionalsListCached(clinicId);
});

export const getCachedClinicProfessionalsFull = cache(async (clinicId: string) => {
  return loadClinicProfessionalsFullCached(clinicId);
});

export const getCachedClinicLocations = cache(async (clinicId: string) => {
  return loadClinicLocationsCached(clinicId);
});

export const getCachedClinicSpecialties = cache(async (clinicId: string) => {
  return loadClinicSpecialtiesCached(clinicId);
});

export const getCachedClinicalTemplates = cache(async (clinicId: string) => {
  return loadClinicClinicalTemplatesCached(clinicId);
});

export const getCachedClinicalTemplatesAdmin = cache(async (clinicId: string) => {
  return loadClinicClinicalTemplatesAdminCached(clinicId);
});

export const getCachedClinicSettings = cache(async (clinicId: string) => {
  return loadClinicSettingsCached(clinicId);
});

/** Per-request dedupe for PAMI planilla catalog (categories + templates). */
export const getCachedPamiPlanillaCatalog = cache(async (clinicId: string) => {
  return loadPamiPlanillaCatalogCached(clinicId);
});

/** Empty features context when no clinic is selected. */
export function emptyClinicFeaturesContext(): ClinicFeaturesContext {
  return {
    plugins: resolveClinicPlugins([]),
    flags: resolveClinicFeatureFlags([]),
  };
}
