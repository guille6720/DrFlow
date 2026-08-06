export {
  FEATURE_NAV_ENTRIES,
  FEATURE_NAV_ITEMS,
  type FeatureNavEntry,
  type FeatureNavGroup,
  type FeatureNavItem,
  type FeatureNavPermission,
  flattenNavEntries,
  isFeatureNavGroup,
} from "@/features/_shared/nav";
export {
  FEATURE_MODULES,
  type FeatureModuleDef,
  type FeatureModuleId,
  type FeatureModuleStatus,
  getFeatureModule,
  listReadyFeatureModules,
} from "@/features/_shared/registry";
