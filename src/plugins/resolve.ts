import type { PluginId } from "@/plugins/registry";
import { getPluginDefinition, PLUGIN_REGISTRY } from "@/plugins/registry";

export type ClinicPluginRow = {
  plugin_id: string;
  enabled: boolean;
};

export type ResolvedClinicPlugins = Record<PluginId, boolean>;

/** Merge DB rows with registry defaults — missing rows use defaultEnabled. */
export function resolveClinicPlugins(rows: ClinicPluginRow[]): ResolvedClinicPlugins {
  const resolved = {} as ResolvedClinicPlugins;
  for (const def of PLUGIN_REGISTRY) {
    const row = rows.find((r) => r.plugin_id === def.id);
    resolved[def.id] = row?.enabled ?? def.defaultEnabled;
  }
  return resolved;
}

export function isPluginEnabled(
  plugins: ResolvedClinicPlugins,
  pluginId: PluginId
): boolean {
  return plugins[pluginId] ?? getPluginDefinition(pluginId).defaultEnabled;
}

export function enabledPluginIds(plugins: ResolvedClinicPlugins): PluginId[] {
  return PLUGIN_REGISTRY.filter((p) => isPluginEnabled(plugins, p.id)).map((p) => p.id);
}

export function isRouteAllowedByPlugins(path: string, plugins: ResolvedClinicPlugins): boolean {
  for (const def of PLUGIN_REGISTRY) {
    const matches = def.routes.some(
      (route) => path === route || path.startsWith(`${route}/`)
    );
    if (matches && !isPluginEnabled(plugins, def.id)) return false;
  }
  return true;
}

export function filterNavByPlugins<T extends { featureId: string }>(
  items: T[],
  plugins: ResolvedClinicPlugins,
  pluginByFeature: Partial<Record<string, PluginId>>
): T[] {
  return items.filter((item) => {
    const pluginId = pluginByFeature[item.featureId];
    if (!pluginId) return true;
    return isPluginEnabled(plugins, pluginId);
  });
}
