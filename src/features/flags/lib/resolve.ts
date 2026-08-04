import type { FeatureFlagId } from "@/features/flags/lib/registry";
import { getFeatureFlagDefinition, FEATURE_FLAG_REGISTRY } from "@/features/flags/lib/registry";
import { isPluginEnabled, type ResolvedClinicPlugins } from "@/plugins/resolve";

export type ClinicFeatureFlagRow = {
  flag_id: string;
  enabled: boolean;
};

export type ResolvedClinicFeatureFlags = Record<FeatureFlagId, boolean>;

export type ClinicFeaturesContext = {
  plugins: ResolvedClinicPlugins;
  flags: ResolvedClinicFeatureFlags;
};

export function resolveClinicFeatureFlags(rows: ClinicFeatureFlagRow[]): ResolvedClinicFeatureFlags {
  const resolved = {} as ResolvedClinicFeatureFlags;
  for (const def of FEATURE_FLAG_REGISTRY) {
    const row = rows.find((r) => r.flag_id === def.id);
    resolved[def.id] = row?.enabled ?? def.defaultEnabled;
  }
  return resolved;
}

export function isFeatureFlagEnabled(
  ctx: ClinicFeaturesContext,
  flagId: FeatureFlagId
): boolean {
  const def = getFeatureFlagDefinition(flagId);
  if (def.requiresPlugin && !isPluginEnabled(ctx.plugins, def.requiresPlugin)) {
    return false;
  }
  return ctx.flags[flagId] ?? def.defaultEnabled;
}

export function filterNavByFeatureFlags<T extends { href: string }>(
  items: T[],
  ctx: ClinicFeaturesContext,
  flagByHref: Partial<Record<string, FeatureFlagId>>
): T[] {
  return items.filter((item) => {
    const flagId = flagByHref[item.href];
    if (!flagId) return true;
    return isFeatureFlagEnabled(ctx, flagId);
  });
}

export function buildClinicFeaturesContext(
  plugins: ResolvedClinicPlugins,
  flags: ResolvedClinicFeatureFlags
): ClinicFeaturesContext {
  return { plugins, flags };
}
