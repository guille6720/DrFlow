export {
  ClinicFeaturesProvider,
  ClinicPluginsProvider,
  useClinicFeatures,
  useClinicPlugins,
  usePluginEnabled,
  useFeatureFlag,
} from "@/components/plugins/clinic-plugins-provider";
export {
  FEATURE_FLAG_REGISTRY,
  NAV_FLAG_BY_HREF,
  getFeatureFlagDefinition,
  listFeatureFlags,
  type FeatureFlagId,
  type FeatureFlagCategory,
  type FeatureFlagDefinition,
} from "@/lib/features/flags/registry";
export {
  buildClinicFeaturesContext,
  filterNavByFeatureFlags,
  isFeatureFlagEnabled,
  resolveClinicFeatureFlags,
  type ClinicFeaturesContext,
  type ResolvedClinicFeatureFlags,
} from "@/lib/features/flags/resolve";
export {
  loadClinicFeatureFlags,
  loadClinicFeatures,
  seedDefaultClinicFeatureFlags,
} from "@/lib/server/load-clinic-feature-flags";
export {
  updateClinicFeatureFlag,
  getClinicFeatureFlagSettings,
} from "@/lib/actions/clinic-feature-flags";
