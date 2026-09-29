import { describe, expect, it } from "vitest";

import {
  CUSTOMIZATION_FEATURE_BY_HREF,
  FEATURE_CUSTOMIZATION_REGISTRY,
  FEATURE_KEYS,
  isFeatureKey,
} from "@/core/customizations/registry";
import {
  customizationFeatureForPath,
  defaultFeatureMap,
  getFeatureConfigFromMap,
  isFeatureEnabledInMap,
  isHrefAllowedByCustomizations,
  resolveFeatureMap,
  type ResolveWarning,
  validateFeatureConfig,
} from "@/core/customizations/resolve";

const REQUIRED_KEYS = [
  "clinic_module",
  "geriatrics_module",
  "home_hospitalization_module",
  "waiting_room",
  "advanced_agenda",
  "unlimited_patients",
  "advanced_reports",
  "professional_management",
  "professional_settlements",
  "custom_branding",
  "custom_fields",
  "ai_assistant",
  "national_electronic_prescription",
];

describe("feature customization registry", () => {
  it("contains exactly the initial catalog", () => {
    expect([...FEATURE_KEYS].sort()).toEqual([...REQUIRED_KEYS].sort());
  });

  it("defaults preserve current behavior (existing modules ON, non-existent modules OFF)", () => {
    const off = FEATURE_KEYS.filter((k) => !FEATURE_CUSTOMIZATION_REGISTRY[k].defaultEnabled).sort();
    expect(off).toEqual([
      "custom_branding",
      "custom_fields",
      "home_hospitalization_module",
      "national_electronic_prescription",
    ]);
  });

  it("billing-sensitive features keep their existing gate and require confirmation", () => {
    expect(FEATURE_CUSTOMIZATION_REGISTRY.unlimited_patients.gatedBy).toBe("plan.premium");
    expect(FEATURE_CUSTOMIZATION_REGISTRY.unlimited_patients.critical).toBe(true);
    expect(FEATURE_CUSTOMIZATION_REGISTRY.unlimited_patients.configurableByUser).toBe(false);
    expect(FEATURE_CUSTOMIZATION_REGISTRY.geriatrics_module.gatedBy).toBe("product.geriatrics");
  });

  it("gates /sala-espera through waiting_room only (proof of concept)", () => {
    expect(CUSTOMIZATION_FEATURE_BY_HREF).toEqual({ "/sala-espera": "waiting_room" });
    expect(customizationFeatureForPath("/sala-espera")).toBe("waiting_room");
    expect(customizationFeatureForPath("/sala-espera/x")).toBe("waiting_room");
    expect(customizationFeatureForPath("/sala-esperas")).toBeNull();
    expect(customizationFeatureForPath("/turnos/agenda")).toBeNull();
  });
});

describe("Test A — clinic disabled vs enabled", () => {
  it("clinic A disabled, clinic B enabled", () => {
    const a = resolveFeatureMap({
      clinic: [{ feature_key: "waiting_room", enabled: false, config: null }],
    });
    const b = resolveFeatureMap({
      clinic: [{ feature_key: "waiting_room", enabled: true, config: null }],
    });
    expect(isFeatureEnabledInMap(a, "waiting_room")).toBe(false);
    expect(a.waiting_room.source).toBe("clinic");
    expect(isFeatureEnabledInMap(b, "waiting_room")).toBe(true);
    expect(isHrefAllowedByCustomizations("/sala-espera", a)).toBe(false);
    expect(isHrefAllowedByCustomizations("/sala-espera", b)).toBe(true);
  });
});

describe("Test B — user override", () => {
  it("user override wins over clinic setting; other users keep clinic value", () => {
    const clinic = [{ feature_key: "waiting_room", enabled: true, config: null }];
    const userX = resolveFeatureMap({
      clinic,
      user: [{ feature_key: "waiting_room", enabled: false, config: null }],
    });
    const userY = resolveFeatureMap({ clinic, user: [] });
    expect(userX.waiting_room).toMatchObject({ enabled: false, source: "user" });
    expect(userY.waiting_room).toMatchObject({ enabled: true, source: "clinic" });
  });

  it("user can be enabled when clinic disabled (precedence USER > CLINIC)", () => {
    const map = resolveFeatureMap({
      clinic: [{ feature_key: "waiting_room", enabled: false, config: null }],
      user: [{ feature_key: "waiting_room", enabled: true, config: null }],
    });
    expect(map.waiting_room).toMatchObject({ enabled: true, source: "user" });
  });

  it("NULL enabled inherits while config still applies", () => {
    const map = resolveFeatureMap({
      clinic: [{ feature_key: "waiting_room", enabled: false, config: null }],
      user: [{ feature_key: "waiting_room", enabled: null, config: { show_document_number: false } }],
    });
    expect(map.waiting_room.enabled).toBe(false);
    expect(map.waiting_room.source).toBe("clinic");
    expect(map.waiting_room.config).toEqual({ show_document_number: false, show_cancelled_section: true });
    expect(map.waiting_room.configSource).toBe("user");
  });

  it("ignores user overrides for features not configurable by user (e.g. unlimited_patients)", () => {
    const map = resolveFeatureMap({
      user: [{ feature_key: "unlimited_patients", enabled: false, config: null }],
    });
    expect(map.unlimited_patients).toMatchObject({ enabled: true, source: "default" });
  });
});

describe("Test G — no configuration means identical behavior", () => {
  it("empty payload, null payload and default map are identical", () => {
    const defaults = defaultFeatureMap();
    expect(resolveFeatureMap(null)).toEqual(defaults);
    expect(resolveFeatureMap({ definitions: [], clinic: [], user: [] })).toEqual(defaults);
    for (const key of FEATURE_KEYS) {
      expect(defaults[key].enabled).toBe(FEATURE_CUSTOMIZATION_REGISTRY[key].defaultEnabled);
      expect(defaults[key].source).toBe("default");
    }
    expect(isHrefAllowedByCustomizations("/sala-espera", defaults)).toBe(true);
    expect(getFeatureConfigFromMap(defaults, "waiting_room")).toEqual({
      show_document_number: true,
      show_cancelled_section: true,
    });
  });
});

describe("fail-safe behavior", () => {
  it("unknown feature is denied", () => {
    expect(isFeatureKey("drop_tables")).toBe(false);
    expect(isFeatureEnabledInMap(defaultFeatureMap(), "drop_tables")).toBe(false);
    expect(isFeatureEnabledInMap(null, "not_a_feature")).toBe(false);
    expect(getFeatureConfigFromMap(defaultFeatureMap(), "not_a_feature")).toBeNull();
  });

  it("unknown DB rows are ignored", () => {
    const map = resolveFeatureMap({
      clinic: [{ feature_key: "evil_feature", enabled: true, config: { a: 1 } }],
    });
    expect(map).toEqual(defaultFeatureMap());
    expect("evil_feature" in map).toBe(false);
  });

  it("missing map falls back to the code default", () => {
    expect(isFeatureEnabledInMap(null, "waiting_room")).toBe(true);
    expect(isFeatureEnabledInMap(undefined, "custom_fields")).toBe(false);
  });

  it("invalid config is ignored and reported without values", () => {
    const warnings: ResolveWarning[] = [];
    const map = resolveFeatureMap(
      {
        clinic: [
          { feature_key: "waiting_room", enabled: false, config: { show_document_number: "DNI 12345678" } },
          { feature_key: "custom_fields", enabled: null, config: ["not", "object"] },
        ],
      },
      warnings
    );
    expect(map.waiting_room.enabled).toBe(false);
    expect(map.waiting_room.config).toEqual({ show_document_number: true, show_cancelled_section: true });
    expect(map.waiting_room.configSource).toBe("default");
    expect(warnings).toHaveLength(2);
    expect(JSON.stringify(warnings)).not.toContain("12345678");
    expect(warnings[0]).toMatchObject({ featureKey: "waiting_room", layer: "clinic", paths: ["show_document_number"] });
  });

  it("inactive definitions ignore overrides", () => {
    const map = resolveFeatureMap({
      definitions: [{ feature_key: "waiting_room", is_active: false }],
      clinic: [{ feature_key: "waiting_room", enabled: false, config: null }],
    });
    expect(map.waiting_room).toMatchObject({ enabled: true, source: "default" });
  });
});

describe("server-side config validation", () => {
  it("rejects unknown keys, wrong types and executable-looking payloads", () => {
    expect(validateFeatureConfig("waiting_room", { show_document_number: false }).ok).toBe(true);
    expect(validateFeatureConfig("waiting_room", { script: "alert(1)" }).ok).toBe(false);
    expect(validateFeatureConfig("waiting_room", { show_document_number: "false" }).ok).toBe(false);
    expect(validateFeatureConfig("waiting_room", "{}").ok).toBe(false);
    expect(validateFeatureConfig("custom_branding", { logo_url: "javascript:alert(1)" }).ok).toBe(false);
    expect(validateFeatureConfig("custom_branding", { primary_color: "#0f766e" }).ok).toBe(true);
    expect(validateFeatureConfig("ai_assistant", { anything: 1 }).ok).toBe(false);
  });
});
