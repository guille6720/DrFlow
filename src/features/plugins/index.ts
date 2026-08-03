export { ClinicPluginsProvider, useClinicPlugins, usePluginEnabled, ClinicFeaturesProvider, useClinicFeatures, useFeatureFlag } from "@/components/plugins/clinic-plugins-provider";
export {
  getPluginDefinition,
  listToggleablePlugins,
  NAV_PLUGIN_BY_FEATURE,
  PLUGIN_REGISTRY,
  pluginForPath,
  type PluginId,
} from "@/plugins/registry";
export {
  isPluginEnabled,
  isRouteAllowedByPlugins,
  resolveClinicPlugins,
  type ResolvedClinicPlugins,
} from "@/plugins/resolve";
export { loadClinicPlugins, seedDefaultClinicPlugins } from "@/lib/server/load-clinic-plugins";
export { updateClinicPlugin, getClinicPluginSettings } from "@/lib/actions/clinic-plugins";
