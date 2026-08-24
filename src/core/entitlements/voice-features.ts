import { FEATURES } from "@/core/entitlements/features";
import { areFeaturesEntitledBySnapshot } from "@/core/entitlements/module-summary";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";

const VOICE_ENTITLEMENT_KEYS = [FEATURES.VOICE, FEATURES.AI_TRANSCRIPTION] as const;

/** Browser STT only — does not consume ai.monthly_transcriptions server-side. */
export function isVoiceInputEntitledBySnapshot(
  snapshot: ClientEntitlementsSnapshot | null
): boolean {
  return areFeaturesEntitledBySnapshot([...VOICE_ENTITLEMENT_KEYS], snapshot);
}
