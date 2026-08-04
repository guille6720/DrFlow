export {
  ClinicFeaturesProvider,
  ClinicPluginsProvider,
  useClinicFeatures,
  useClinicPlugins,
  usePluginEnabled,
  useFeatureFlag,
} from "@/features/plugins/providers";
export {
  FEATURE_FLAG_REGISTRY,
  NAV_FLAG_BY_HREF,
  getFeatureFlagDefinition,
  listFeatureFlags,
  type FeatureFlagId,
  type FeatureFlagCategory,
  type FeatureFlagDefinition,
} from "@/features/flags/lib/registry";
export {
  buildClinicFeaturesContext,
  filterNavByFeatureFlags,
  isFeatureFlagEnabled,
  resolveClinicFeatureFlags,
  type ClinicFeaturesContext,
  type ResolvedClinicFeatureFlags,
} from "@/features/flags/lib/resolve";
export {
  loadClinicFeatureFlags,
  loadClinicFeatures,
  seedDefaultClinicFeatureFlags,
} from "@/lib/server/load-clinic-feature-flags";
export {
  updateClinicFeatureFlag,
  getClinicFeatureFlagSettings,
} from "@/lib/actions/clinic-feature-flags";
