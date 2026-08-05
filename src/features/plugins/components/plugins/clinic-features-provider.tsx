"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

import type { FeatureFlagId } from "@/features/flags/lib/registry";
import {
  buildClinicFeaturesContext,
  type ClinicFeaturesContext,
  isFeatureFlagEnabled,
  type ResolvedClinicFeatureFlags,
} from "@/features/flags/lib/resolve";

import type { PluginId } from "@/plugins/registry";
import { isPluginEnabled, type ResolvedClinicPlugins } from "@/plugins/resolve";

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
