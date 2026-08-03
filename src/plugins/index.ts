export {
  getPluginDefinition,
  listToggleablePlugins,
  NAV_PLUGIN_BY_FEATURE,
  PLUGIN_REGISTRY,
  pluginForPath,
  type PluginDefinition,
  type PluginId,
  type PluginTier,
} from "@/plugins/registry";
export {
  enabledPluginIds,
  filterNavByPlugins,
  isPluginEnabled,
  isRouteAllowedByPlugins,
  resolveClinicPlugins,
  type ResolvedClinicPlugins,
} from "@/plugins/resolve";
