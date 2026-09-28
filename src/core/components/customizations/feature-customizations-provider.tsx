"use client";

import { createContext, type ReactNode, useContext } from "react";

import { defaultFeatureConfig, getFeatureDefinition, isFeatureKey } from "@/core/customizations/registry";
import {
  defaultCustomizationsSnapshot,
  type FeatureCustomizationsSnapshot,
  type FeatureSource,
} from "@/core/customizations/resolve";

const FeatureCustomizationsContext = createContext<FeatureCustomizationsSnapshot>(
  defaultCustomizationsSnapshot(null)
);

/** Snapshot is resolved on the server per request, so the first client render already has final values. */
export function FeatureCustomizationsProvider({
  snapshot,
  children,
}: {
  snapshot: FeatureCustomizationsSnapshot;
  children: ReactNode;
}) {
  return (
    <FeatureCustomizationsContext.Provider value={snapshot}>
      {children}
    </FeatureCustomizationsContext.Provider>
  );
}

export function useFeatureCustomizations(): FeatureCustomizationsSnapshot {
  return useContext(FeatureCustomizationsContext);
}

export interface UseFeatureResult<C extends Record<string, unknown> = Record<string, unknown>> {
  enabled: boolean;
  config: C;
  source: FeatureSource | "unknown";
}

/** UX only — authorization is enforced on the server (pages, route handlers, actions). */
export function useFeature<C extends Record<string, unknown> = Record<string, unknown>>(
  key: string
): UseFeatureResult<C> {
  const snapshot = useFeatureCustomizations();
  if (!isFeatureKey(key)) {
    return { enabled: false, config: {} as C, source: "unknown" };
  }
  const entry = snapshot.features[key];
  if (!entry) {
    return {
      enabled: getFeatureDefinition(key).defaultEnabled,
      config: defaultFeatureConfig(key) as C,
      source: "default",
    };
  }
  return { enabled: entry.enabled, config: entry.config as C, source: entry.source };
}
