import { describe, expect, it } from "vitest";
import {
  FEATURE_MODULES,
  FEATURE_NAV_ITEMS,
  getFeatureModule,
  listReadyFeatureModules,
} from "@/features/_shared";
import { LABORATORIO_MODULE_PLANNED } from "@/features/laboratorio";
import { IMAGENES_MODULE_PLANNED } from "@/features/imagenes";
import { buildClinicalSummary } from "@/features/ia";

describe("feature registry", () => {
  it("lists all roadmap modules", () => {
    const ids = FEATURE_MODULES.map((m) => m.id);
    expect(ids).toContain("core");
    expect(ids).toContain("pacientes");
    expect(ids).toContain("laboratorio");
    expect(ids).toContain("imagenes");
    expect(ids).toContain("ia");
  });

  it("getFeatureModule returns definition", () => {
    const mod = getFeatureModule("caja");
    expect(mod.routes).toContain("/caja");
    expect(mod.status).toBe("ready");
  });

  it("listReadyFeatureModules excludes planned", () => {
    const ready = listReadyFeatureModules();
    expect(ready.some((m) => m.id === "laboratorio")).toBe(false);
    expect(ready.some((m) => m.id === "pacientes")).toBe(true);
  });

  it("nav items reference known routes", () => {
    for (const item of FEATURE_NAV_ITEMS) {
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.label.length).toBeGreaterThan(0);
      getFeatureModule(item.featureId);
    }
  });
});

describe("feature module barrels", () => {
  it("ia exports clinical assistant utils", () => {
    expect(buildClinicalSummary).toBeTypeOf("function");
  });

  it("planned modules are flagged", () => {
    expect(LABORATORIO_MODULE_PLANNED).toBe(true);
    expect(IMAGENES_MODULE_PLANNED).toBe(true);
  });
});

describe("feature barrels exist (static)", () => {
  const barrels = [
    "agenda",
    "pacientes",
    "historias",
    "recetas",
    "caja",
    "pami",
    "administracion",
    "profesionales",
    "configuracion",
    "dashboard",
    "integraciones",
    "pharmacology",
    "portal",
    "ia",
    "voice",
    "telemedicina",
    "facturacion",
    "core",
  ];

  it.each(barrels)("src/features/%s/index.ts exists", async (name) => {
    const { access } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    await expect(access(resolve(process.cwd(), `src/features/${name}/index.ts`))).resolves.toBeUndefined();
  });
});

describe("dashboard pages use feature modules (static)", () => {
  it("caja page imports from @/features/caja", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const src = readFileSync(resolve(process.cwd(), "src/app/(dashboard)/caja/page.tsx"), "utf8");
    expect(src).toMatch(/from "@\/features\/caja"/);
  });

  it("sidebar imports FEATURE_NAV_ITEMS", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const src = readFileSync(resolve(process.cwd(), "src/core/components/layout/sidebar.tsx"), "utf8");
    expect(src).toMatch(/FEATURE_NAV_ITEMS/);
  });
});
