import { type FeatureKey, FEATURES } from "@/core/entitlements/features";
import { isFeatureEntitledBySnapshot } from "@/core/entitlements/snapshot-access";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";

/** In-page Configuración sections (no href) that wrap a commercial add-on. */
export const CONFIGURACION_SECTION_ENTITLEMENT: Partial<Record<string, FeatureKey>> = {
  "asistente-ia": FEATURES.AI,
  "api-publica": FEATURES.API,
  pami: FEATURES.PAMI,
  apps: FEATURES.PORTAL,
};

export function configuracionSectionFeature(sectionId: string): FeatureKey | undefined {
  return CONFIGURACION_SECTION_ENTITLEMENT[sectionId];
}

/** UX only. Missing catalog fails open. */
export function isConfiguracionSectionEntitledBySnapshot(
  sectionId: string,
  snapshot: ClientEntitlementsSnapshot | null
): boolean {
  return isFeatureEntitledBySnapshot(configuracionSectionFeature(sectionId), snapshot);
}
