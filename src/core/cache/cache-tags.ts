/** Cache tag helpers for Next.js `unstable_cache` / `revalidateTag`. */

export function clinicPluginsTag(clinicId: string): string {
  return `clinic-${clinicId}-plugins`;
}

export function clinicFeatureFlagsTag(clinicId: string): string {
  return `clinic-${clinicId}-feature-flags`;
}

export function clinicPortalTag(clinicId: string): string {
  return `clinic-${clinicId}-portal`;
}

export function clinicProfessionalsTag(clinicId: string): string {
  return `clinic-${clinicId}-professionals`;
}

export function clinicLocationsTag(clinicId: string): string {
  return `clinic-${clinicId}-locations`;
}

export function clinicSpecialtiesTag(clinicId: string): string {
  return `clinic-${clinicId}-specialties`;
}

export function clinicClinicalTemplatesTag(clinicId: string): string {
  return `clinic-${clinicId}-clinical-templates`;
}

export function clinicPamiPlanillasTag(clinicId: string): string {
  return `clinic-${clinicId}-pami-planillas`;
}

export function clinicSettingsTag(clinicId: string): string {
  return `clinic-${clinicId}-settings`;
}

export function pathologyDrugsTag(pathologyId: string): string {
  return `pathology-drugs-${pathologyId}`;
}

/** Invalidates all semi-static clinic metadata caches for a clinic. */
export function clinicMetadataTags(clinicId: string): string[] {
  return [
    clinicPluginsTag(clinicId),
    clinicFeatureFlagsTag(clinicId),
    clinicPortalTag(clinicId),
    clinicProfessionalsTag(clinicId),
    clinicLocationsTag(clinicId),
    clinicSpecialtiesTag(clinicId),
    clinicClinicalTemplatesTag(clinicId),
    clinicPamiPlanillasTag(clinicId),
    clinicSettingsTag(clinicId),
  ];
}
