import { type FeatureKey, FEATURES } from "@/core/entitlements/features";

/** Lab/planned plugins stay ungated. Enabling still requires the commercial add-on. */
export function addonFeatureForClinicPlugin(pluginId: string): FeatureKey | null {
  if (pluginId === "pami") return FEATURES.PAMI;
  if (pluginId === "ia") return FEATURES.AI;
  if (pluginId === "telemedicina") return FEATURES.TELEMEDICINE;
  if (pluginId === "pharmacology") return FEATURES.PHARMACOLOGY;
  if (pluginId === "portal") return FEATURES.PORTAL;
  if (pluginId === "voice") return FEATURES.VOICE;
  return null;
}

/** Voice also needs ai.transcription (browser STT; no server consume). */
export function addonFeaturesForClinicPlugin(pluginId: string): FeatureKey[] {
  if (pluginId === "voice") return [FEATURES.VOICE, FEATURES.AI_TRANSCRIPTION];
  const primary = addonFeatureForClinicPlugin(pluginId);
  return primary ? [primary] : [];
}
