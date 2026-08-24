import { type FeatureKey, FEATURES } from "@/core/entitlements/features";

import type { DatosFlujo } from "@/features/integraciones/components/datos/data-import-export-flujo";

/** Commercial add-on for export flujos. Imports stay ungated except FHIR (handled separately). */
export function addonFeatureForDatosExportFlujo(flujo: DatosFlujo): FeatureKey | null {
  if (flujo === "export-pacientes" || flujo === "export-masivo") return FEATURES.DATA_EXPORT;
  return null;
}
