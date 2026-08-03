"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PluginId } from "@/plugins/registry";
import { isPluginEnabled, type ResolvedClinicPlugins } from "@/plugins/resolve";

const ClinicPluginsContext = createContext<ResolvedClinicPlugins | null>(null);

export function ClinicPluginsProvider({
  plugins,
  children,
}: {
  plugins: ResolvedClinicPlugins;
  children: ReactNode;
}) {
  return (
    <ClinicPluginsContext.Provider value={plugins}>{children}</ClinicPluginsContext.Provider>
  );
}

export function useClinicPlugins(): ResolvedClinicPlugins {
  const ctx = useContext(ClinicPluginsContext);
  if (!ctx) {
    throw new Error("useClinicPlugins must be used within ClinicPluginsProvider");
  }
  return ctx;
}

export function usePluginEnabled(pluginId: PluginId): boolean {
  return isPluginEnabled(useClinicPlugins(), pluginId);
}
