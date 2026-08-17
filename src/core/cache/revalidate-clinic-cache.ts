import { updateTag } from "next/cache";

import {
  clinicClinicalTemplatesTag,
  clinicCoverageRulesTag,
  clinicFeatureFlagsTag,
  clinicLocationsTag,
  clinicMetadataTags,
  clinicPluginsTag,
  clinicPortalTag,
  clinicProfessionalsTag,
  clinicSettingsTag,
  clinicSpecialtiesTag,
  pathologyDrugsTag,
} from "@/core/cache/cache-tags";

/** Immediate invalidation from Server Actions (read-your-own-writes). */
export function revalidateClinicPluginsCache(clinicId: string): void {
  updateTag(clinicPluginsTag(clinicId));
}

export function revalidateClinicFeatureFlagsCache(clinicId: string): void {
  updateTag(clinicFeatureFlagsTag(clinicId));
}

export function revalidateClinicPortalCache(clinicId: string): void {
  updateTag(clinicPortalTag(clinicId));
}

export function revalidateClinicProfessionalsCache(clinicId: string): void {
  updateTag(clinicProfessionalsTag(clinicId));
}

export function revalidateClinicLocationsCache(clinicId: string): void {
  updateTag(clinicLocationsTag(clinicId));
}

export function revalidateClinicSpecialtiesCache(clinicId: string): void {
  updateTag(clinicSpecialtiesTag(clinicId));
}

export function revalidateClinicClinicalTemplatesCache(clinicId: string): void {
  updateTag(clinicClinicalTemplatesTag(clinicId));
}

export function revalidateClinicSettingsCache(clinicId: string): void {
  updateTag(clinicSettingsTag(clinicId));
}

export function revalidateClinicCoverageRulesCache(clinicId: string): void {
  updateTag(clinicCoverageRulesTag(clinicId));
}

/** Plugins, flags, portal, professionals, locations, specialties, templates, coverage rules. */
export function revalidateClinicMetadataCache(clinicId: string): void {
  for (const tag of clinicMetadataTags(clinicId)) {
    updateTag(tag);
  }
}

export function revalidatePathologyDrugsCache(pathologyId: string): void {
  updateTag(pathologyDrugsTag(pathologyId));
}
