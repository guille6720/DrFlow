"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { PluginId } from "@/plugins/registry";
import { isPluginEnabled, type ResolvedClinicPlugins } from "@/plugins/resolve";
import {
  buildClinicFeaturesContext,
  isFeatureFlagEnabled,
  type ClinicFeaturesContext,
  type ResolvedClinicFeatureFlags,
} from "@/lib/features/flags/resolve";
import type { FeatureFlagId } from "@/lib/features/flags/registry";

const ClinicFeaturesContext = createContext<ClinicFeaturesContext | null>(null);

export function ClinicFeaturesProvider({
  plugins,
  flags,
  children,
}: {
  plugins: ResolvedClinicPlugins;
  flags: ResolvedClinicFeatureFlags;
  children: ReactNode;
}) {
  const value = useMemo(
    () => buildClinicFeaturesContext(plugins, flags),
    [plugins, flags]
  );

  return (
    <ClinicFeaturesContext.Provider value={value}>{children}</ClinicFeaturesContext.Provider>
  );
}

/** @deprecated Use ClinicFeaturesProvider */
export const ClinicPluginsProvider = ClinicFeaturesProvider;

export function useClinicFeatures(): ClinicFeaturesContext {
  const ctx = useContext(ClinicFeaturesContext);
  if (!ctx) {
    throw new Error("useClinicFeatures must be used within ClinicFeaturesProvider");
  }
  return ctx;
}

export function useClinicPlugins(): ResolvedClinicPlugins {
  return useClinicFeatures().plugins;
}

export function usePluginEnabled(pluginId: PluginId): boolean {
  return isPluginEnabled(useClinicFeatures().plugins, pluginId);
}

export function useFeatureFlag(flagId: FeatureFlagId): boolean {
  return isFeatureFlagEnabled(useClinicFeatures(), flagId);
}
