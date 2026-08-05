import { describe, expect, it } from "vitest";

import {
  getPluginDefinition,
  listToggleablePlugins,
  PLUGIN_REGISTRY,
  pluginForPath,
} from "@/plugins/registry";
import { NAV_PLUGIN_BY_FEATURE } from "@/plugins/registry";
import {
  filterNavByPlugins,
  isRouteAllowedByPlugins,
  resolveClinicPlugins,
} from "@/plugins/resolve";

describe("plugin registry", () => {
  it("lists toggleable optional and lab plugins", () => {
    const toggleable = listToggleablePlugins();
    expect(toggleable.some((p) => p.id === "pami")).toBe(true);
    expect(toggleable.some((p) => p.id === "laboratorio")).toBe(false);
  });

  it("pluginForPath maps routes", () => {
    expect(pluginForPath("/guia-pami")).toBe("pami");
    expect(pluginForPath("/herramientas/farmacologia")).toBe("pharmacology");
    expect(pluginForPath("/pacientes")).toBeNull();
  });

  it("every plugin has definition", () => {
    for (const p of PLUGIN_REGISTRY) {
      expect(getPluginDefinition(p.id).label.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveClinicPlugins", () => {
  it("uses defaults when no rows", () => {
    const resolved = resolveClinicPlugins([]);
    expect(resolved.pami).toBe(true);
    expect(resolved.telemedicina).toBe(false);
  });

  it("overrides with DB row", () => {
    const resolved = resolveClinicPlugins([{ plugin_id: "pami", enabled: false }]);
    expect(resolved.pami).toBe(false);
  });

  it("isRouteAllowedByPlugins blocks disabled plugin routes", () => {
    const plugins = resolveClinicPlugins([{ plugin_id: "pami", enabled: false }]);
    expect(isRouteAllowedByPlugins("/guia-pami", plugins)).toBe(false);
    expect(isRouteAllowedByPlugins("/pacientes", plugins)).toBe(true);
  });

  it("filterNavByPlugins hides PAMI nav items", () => {
    const plugins = resolveClinicPlugins([{ plugin_id: "pami", enabled: false }]);
    const nav = [
      { featureId: "pami", href: "/guia-pami", label: "PAMI" },
      { featureId: "pacientes", href: "/pacientes", label: "Pacientes" },
    ];
    const filtered = filterNavByPlugins(nav, plugins, NAV_PLUGIN_BY_FEATURE);
    expect(filtered.map((i) => i.href)).toEqual(["/pacientes"]);
  });
});

describe("049_plugins_phase13 migration", () => {
  it("creates clinic_plugins table", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/049_plugins_phase13.sql"),
      "utf8"
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS clinic_plugins/);
    expect(sql).toMatch(/clinic_plugins_select/);
  });
});
