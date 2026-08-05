import { describe, expect, it } from "vitest";

import {
  FEATURE_FLAG_REGISTRY,
  getFeatureFlagDefinition,
  listFeatureFlags,
  NAV_FLAG_BY_HREF,
} from "@/features/flags/lib/registry";
import {
  buildClinicFeaturesContext,
  filterNavByFeatureFlags,
  isFeatureFlagEnabled,
  resolveClinicFeatureFlags,
} from "@/features/flags/lib/resolve";

import { resolveClinicPlugins } from "@/plugins/resolve";

describe("feature flag registry", () => {
  it("lists all flags with definitions", () => {
    const flags = listFeatureFlags();
    expect(flags.length).toBeGreaterThanOrEqual(8);
    for (const f of FEATURE_FLAG_REGISTRY) {
      expect(getFeatureFlagDefinition(f.id).label.length).toBeGreaterThan(0);
    }
  });

  it("maps recordatorios nav href", () => {
    expect(NAV_FLAG_BY_HREF["/recordatorios"]).toBe("recordatorios");
  });
});

describe("resolveClinicFeatureFlags", () => {
  it("uses defaults when no rows", () => {
    const resolved = resolveClinicFeatureFlags([]);
    expect(resolved.command_palette).toBe(true);
    expect(resolved.floating_actions).toBe(true);
  });

  it("overrides with DB row", () => {
    const resolved = resolveClinicFeatureFlags([
      { flag_id: "command_palette", enabled: false },
    ]);
    expect(resolved.command_palette).toBe(false);
  });
});

describe("isFeatureFlagEnabled", () => {
  const baseCtx = buildClinicFeaturesContext(resolveClinicPlugins([]), resolveClinicFeatureFlags([]));

  it("respects flag value", () => {
    const ctx = buildClinicFeaturesContext(
      baseCtx.plugins,
      resolveClinicFeatureFlags([{ flag_id: "floating_actions", enabled: false }])
    );
    expect(isFeatureFlagEnabled(ctx, "floating_actions")).toBe(false);
  });

  it("requires plugin when flag has requiresPlugin", () => {
    const ctx = buildClinicFeaturesContext(
      resolveClinicPlugins([{ plugin_id: "ia", enabled: false }]),
      resolveClinicFeatureFlags([])
    );
    expect(isFeatureFlagEnabled(ctx, "consultation_assistant")).toBe(false);
  });

  it("allows plugin-dependent flag when plugin enabled", () => {
    const ctx = buildClinicFeaturesContext(
      resolveClinicPlugins([{ plugin_id: "ia", enabled: true }]),
      resolveClinicFeatureFlags([])
    );
    expect(isFeatureFlagEnabled(ctx, "consultation_assistant")).toBe(true);
  });
});

describe("filterNavByFeatureFlags", () => {
  it("hides recordatorios when flag off", () => {
    const ctx = buildClinicFeaturesContext(
      resolveClinicPlugins([]),
      resolveClinicFeatureFlags([{ flag_id: "recordatorios", enabled: false }])
    );
    const nav = [
      { href: "/recordatorios", label: "Recordatorios" },
      { href: "/pacientes", label: "Pacientes" },
    ];
    const filtered = filterNavByFeatureFlags(nav, ctx, NAV_FLAG_BY_HREF);
    expect(filtered.map((i) => i.href)).toEqual(["/pacientes"]);
  });
});

describe("050_feature_flags_phase14 migration", () => {
  it("creates clinic_feature_flags table", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/050_feature_flags_phase14.sql"),
      "utf8"
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS clinic_feature_flags/);
    expect(sql).toMatch(/clinic_feature_flags_select/);
  });
});
