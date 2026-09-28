import {
  CUSTOMIZATION_FEATURE_BY_HREF,
  defaultFeatureConfig,
  FEATURE_KEYS,
  type FeatureKey,
  getFeatureDefinition,
  isFeatureKey,
} from "@/core/customizations/registry";

/**
 * Precedence: USER (clinic_id + user_id) -> CLINIC (clinic_id) -> GLOBAL default (code registry).
 * `enabled` and each config layer resolve independently; a NULL `enabled` inherits.
 */
export type FeatureSource = "user" | "clinic" | "default";

export interface ResolvedFeature {
  enabled: boolean;
  config: Record<string, unknown>;
  source: FeatureSource;
  configSource: FeatureSource;
}

export type FeatureMap = Record<FeatureKey, ResolvedFeature>;

export interface FeatureCustomizationsSnapshot {
  clinicId: string | null;
  features: FeatureMap;
  /** True when settings could not be loaded; every feature then uses its code default. */
  degraded: boolean;
}

export interface FeatureSettingRow {
  feature_key: string;
  enabled: boolean | null;
  config: unknown;
}

export interface FeatureSettingsPayload {
  definitions?: { feature_key: string; is_active?: boolean }[] | null;
  clinic?: FeatureSettingRow[] | null;
  user?: FeatureSettingRow[] | null;
}

export type ResolveWarning = {
  featureKey: FeatureKey;
  layer: "clinic" | "user";
  reason: "invalid_config";
  paths: string[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function defaultResolved(key: FeatureKey): ResolvedFeature {
  return {
    enabled: getFeatureDefinition(key).defaultEnabled,
    config: defaultFeatureConfig(key),
    source: "default",
    configSource: "default",
  };
}

export function defaultFeatureMap(): FeatureMap {
  const map = {} as FeatureMap;
  for (const key of FEATURE_KEYS) {
    map[key] = defaultResolved(key);
  }
  return map;
}

export function defaultCustomizationsSnapshot(
  clinicId: string | null,
  degraded = false
): FeatureCustomizationsSnapshot {
  return { clinicId, features: defaultFeatureMap(), degraded };
}

function indexRows(rows: FeatureSettingRow[] | null | undefined): Map<FeatureKey, FeatureSettingRow> {
  const out = new Map<FeatureKey, FeatureSettingRow>();
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    if (row && isFeatureKey(row.feature_key)) {
      out.set(row.feature_key, row);
    }
  }
  return out;
}

/** Pure: builds the per-request feature map. Invalid config layers are ignored (reported via warnings). */
export function resolveFeatureMap(
  payload: FeatureSettingsPayload | null | undefined,
  warnings: ResolveWarning[] = []
): FeatureMap {
  const map = defaultFeatureMap();
  if (!payload || typeof payload !== "object") return map;

  const inactive = new Set<string>(
    (Array.isArray(payload.definitions) ? payload.definitions : [])
      .filter((d) => d && d.is_active === false)
      .map((d) => d.feature_key)
  );
  const clinicRows = indexRows(payload.clinic);
  const userRows = indexRows(payload.user);

  for (const key of FEATURE_KEYS) {
    if (inactive.has(key)) continue;
    const def = getFeatureDefinition(key);
    const resolved = map[key];
    const layers: { layer: "clinic" | "user"; row: FeatureSettingRow | undefined }[] = [
      { layer: "clinic", row: def.configurableByClinic ? clinicRows.get(key) : undefined },
      { layer: "user", row: def.configurableByUser ? userRows.get(key) : undefined },
    ];

    for (const { layer, row } of layers) {
      if (!row) continue;
      if (typeof row.enabled === "boolean") {
        resolved.enabled = row.enabled;
        resolved.source = layer;
      }
      if (row.config == null) continue;
      if (!isPlainObject(row.config)) {
        warnings.push({ featureKey: key, layer, reason: "invalid_config", paths: [] });
        continue;
      }
      const parsed = def.configSchema.safeParse({ ...resolved.config, ...row.config });
      if (parsed.success) {
        resolved.config = parsed.data;
        resolved.configSource = layer;
      } else {
        warnings.push({
          featureKey: key,
          layer,
          reason: "invalid_config",
          paths: parsed.error.issues.map((i) => i.path.join(".")).slice(0, 10),
        });
      }
    }
  }
  return map;
}

/** Unknown keys (not in the code registry) are always denied. */
export function isFeatureEnabledInMap(map: FeatureMap | null | undefined, key: string): boolean {
  if (!isFeatureKey(key)) return false;
  const entry = map?.[key];
  return entry ? entry.enabled : getFeatureDefinition(key).defaultEnabled;
}

export function getFeatureConfigFromMap(
  map: FeatureMap | null | undefined,
  key: string
): Record<string, unknown> | null {
  if (!isFeatureKey(key)) return null;
  return map?.[key]?.config ?? defaultFeatureConfig(key);
}

/** Feature gating a dashboard path (exact or nested), if any. */
export function customizationFeatureForPath(path: string): FeatureKey | null {
  for (const [href, key] of Object.entries(CUSTOMIZATION_FEATURE_BY_HREF)) {
    if (path === href || path.startsWith(`${href}/`)) return key;
  }
  return null;
}

export function isHrefAllowedByCustomizations(href: string, map: FeatureMap | null | undefined): boolean {
  const key = customizationFeatureForPath(href);
  return key ? isFeatureEnabledInMap(map, key) : true;
}

/** Validates a config payload against the feature schema (server-side, before writing). */
export function validateFeatureConfig(
  key: FeatureKey,
  config: unknown
): { ok: true; config: Record<string, unknown> } | { ok: false; paths: string[] } {
  if (!isPlainObject(config)) return { ok: false, paths: [] };
  const parsed = getFeatureDefinition(key).configSchema.safeParse(config);
  if (!parsed.success) {
    return { ok: false, paths: parsed.error.issues.map((i) => i.path.join(".")).slice(0, 10) };
  }
  return { ok: true, config: config };
}
