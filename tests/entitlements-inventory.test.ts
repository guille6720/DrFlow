import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  ADDON_GATED_FEATURES,
  CORE_UNGATED_FEATURES,
  SEAT_LIMIT_FEATURES,
} from "@/core/entitlements/enforcement";
import { commercialFeatureLabel } from "@/core/entitlements/feature-labels";
import { type FeatureKey, FEATURES, LIMIT_FEATURES } from "@/core/entitlements/features";
import { VISIBLE_COMMERCIAL_MODULES } from "@/core/entitlements/module-summary";
import { addonFeatureForClinicPlugin } from "@/core/entitlements/plugin-features";

import { PLUGIN_REGISTRY } from "@/plugins/registry";

const MIGRATION_121 = resolve(
  process.cwd(),
  "supabase/migrations/121_commercial_entitlements.sql"
);

/** Optional plugins intentionally left ungated (lab / planned). */
const UNGATED_OPTIONAL_PLUGINS = new Set([
  "facturacion",
  "laboratorio",
  "imagenes",
  "odontologia",
  "veterinaria",
]);

describe("commercial entitlements inventory", () => {
  it("seeds every FEATURES key in migration 121", () => {
    const sql = readFileSync(MIGRATION_121, "utf8");
    for (const key of Object.values(FEATURES)) {
      expect(sql).toContain(`'${key}'`);
    }
  });

  it("keeps VISIBLE_COMMERCIAL_MODULES inside ADDON_GATED_FEATURES", () => {
    const gated = new Set<string>(ADDON_GATED_FEATURES);
    for (const key of VISIBLE_COMMERCIAL_MODULES) {
      expect(gated.has(key)).toBe(true);
    }
  });

  it("does not put branding in Tu plan visible modules", () => {
    expect(VISIBLE_COMMERCIAL_MODULES).not.toContain(FEATURES.BRANDING);
  });

  it("labels every visible commercial module in Spanish", () => {
    for (const key of VISIBLE_COMMERCIAL_MODULES) {
      const label = commercialFeatureLabel(key);
      expect(label).not.toBe(key);
      expect(label.length).toBeGreaterThan(2);
    }
  });

  it("maps optional plugins or documents them as intentionally ungated", () => {
    for (const plugin of PLUGIN_REGISTRY) {
      if (plugin.tier === "core") continue;
      const mapped = addonFeatureForClinicPlugin(plugin.id);
      if (UNGATED_OPTIONAL_PLUGINS.has(plugin.id)) {
        expect(mapped).toBeNull();
      } else if (plugin.tier === "optional") {
        expect(mapped).toBeTruthy();
      }
    }
  });

  it("keeps seat/limit catalogs disjoint from core ungated", () => {
    const core = new Set<string>(CORE_UNGATED_FEATURES);
    for (const key of SEAT_LIMIT_FEATURES) {
      expect(core.has(key)).toBe(false);
    }
    for (const key of LIMIT_FEATURES) {
      expect(core.has(key)).toBe(false);
    }
  });

  it("keeps ADDON_GATED_FEATURES free of core clinical keys", () => {
    const core = new Set<string>(CORE_UNGATED_FEATURES);
    for (const key of ADDON_GATED_FEATURES as readonly FeatureKey[]) {
      expect(core.has(key)).toBe(false);
    }
  });
});
