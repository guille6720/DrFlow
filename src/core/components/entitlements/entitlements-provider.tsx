"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

import { isFeatureEnforced } from "@/core/entitlements/enforcement";
import { type FeatureKey, isMeteredFeature } from "@/core/entitlements/features";
import { formatQuotaLabel } from "@/core/entitlements/quota-display";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";
import { isVoiceInputEntitledBySnapshot } from "@/core/entitlements/voice-features";

const EntitlementsContext = createContext<ClientEntitlementsSnapshot | null>(null);

export function EntitlementsProvider({
  snapshot,
  children,
}: {
  snapshot: ClientEntitlementsSnapshot;
  children: ReactNode;
}) {
  const value = useMemo(() => snapshot, [snapshot]);
  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlementsSnapshot(): ClientEntitlementsSnapshot | null {
  return useContext(EntitlementsContext);
}

/** Fail-open when the catalog is missing. UX only — not a security boundary. */
export function useCanUseFeature(featureKey: FeatureKey): boolean {
  const snapshot = useContext(EntitlementsContext);
  if (!isFeatureEnforced(featureKey)) return true;
  if (!snapshot?.catalogAvailable) return true;
  return snapshot.allowed[featureKey] === true;
}

/** Metered usage label for FeatureGate / add-on pages. Hidden if catalog missing. */
export function useFeatureQuotaLabel(featureKey: FeatureKey): string | null {
  const snapshot = useContext(EntitlementsContext);
  if (!snapshot?.catalogAvailable) return null;
  if (!isMeteredFeature(featureKey)) return null;
  const limit = snapshot.limits[featureKey];
  if (limit === undefined) return null;
  return formatQuotaLabel(snapshot.usage[featureKey] ?? 0, limit);
}

/** voice.enabled + ai.transcription (browser STT; no server consume). */
export function useCanUseVoiceInput(): boolean {
  const snapshot = useContext(EntitlementsContext);
  return isVoiceInputEntitledBySnapshot(snapshot);
}
