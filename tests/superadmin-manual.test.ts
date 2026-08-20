import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  MANUAL_SECTIONS,
  SUPERADMIN_MANUAL_META,
} from "@/core/components/superadmin/manual/manual-data";
import { canAccessRoute } from "@/core/permissions/roles";

import { SUPERADMIN_NAV_ENTRIES } from "@/features/_shared/nav";

const ROOT = path.resolve(__dirname, "..");

function readSrc(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

describe("superadmin manual navigation", () => {
  it("superadmin nav includes Manual de uso", () => {
    const group = SUPERADMIN_NAV_ENTRIES.find((e) => e.type === "group" && e.id === "superadmin");
    expect(group && group.type === "group").toBe(true);
    if (!group || group.type !== "group") return;
    const manual = group.children.find((c) => c.href === "/superadmin/manual");
    expect(manual?.label).toBe("Manual de uso");
  });

  it("manual is not in clinic-facing FEATURE_NAV (only SUPERADMIN_NAV)", () => {
    const navTs = readSrc("src/features/_shared/nav.ts");
    const featureBlock = navTs.slice(0, navTs.indexOf("SUPERADMIN_NAV_ENTRIES"));
    expect(featureBlock).not.toContain('/superadmin/manual');
  });
});

describe("superadmin manual route access", () => {
  it("non-superadmin is denied /superadmin/manual", () => {
    expect(canAccessRoute("clinic_admin", "/superadmin/manual", false)).toBe(false);
    expect(canAccessRoute("doctor", "/superadmin/manual", false)).toBe(false);
    expect(canAccessRoute("secretary", "/superadmin/manual", false)).toBe(false);
  });

  it("superadmin can access /superadmin/manual", () => {
    expect(canAccessRoute("clinic_admin", "/superadmin/manual", true)).toBe(true);
    expect(canAccessRoute(null, "/superadmin/manual", true)).toBe(true);
  });

  it("manual page enforces requireSuperadminPage server-side", () => {
    const page = readSrc("src/app/(dashboard)/superadmin/manual/page.tsx");
    expect(page).toContain("requireSuperadminPage");
    expect(page).toContain("SuperadminManualView");
  });

  it("superadmin layout also guards all nested routes including manual", () => {
    const layout = readSrc("src/app/(dashboard)/superadmin/layout.tsx");
    expect(layout).toContain("requireSuperadminPage");
    expect(layout).toContain("/superadmin/manual");
  });
});

describe("superadmin manual content", () => {
  it("renders expected sections", () => {
    const ids = MANUAL_SECTIONS.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "intro",
        "quick-start",
        "dashboard",
        "clinics",
        "clinic-detail",
        "change-plan",
        "downgrade",
        "overrides",
        "temporary",
        "plans",
        "features",
        "usage",
        "recommendations",
        "recommendation-examples",
        "trial",
        "legacy",
        "common-tasks",
        "safety",
        "glossary",
      ])
    );
  });

  it("images have alt text", () => {
    for (const section of MANUAL_SECTIONS) {
      if (!section.image) continue;
      expect(section.image.alt.trim().length).toBeGreaterThan(8);
      expect(section.image.src.startsWith("/superadmin-manual/")).toBe(true);
      expect(section.image.src.endsWith(".svg")).toBe(true);
    }
  });

  it("manual image renderer serves SVG via img (not next/image optimizer)", () => {
    const source = readSrc("src/core/components/superadmin/manual/manual-image.tsx");
    expect(source).toContain("<img");
    expect(source).not.toMatch(/from ["']next\/image["']/);
  });

  it("includes Legacy safety warning", () => {
    const bodies = readSrc("src/core/components/superadmin/manual/manual-section-bodies.tsx");
    expect(bodies).toMatch(/Nunca lo hagas público/i);
    expect(bodies).toMatch(/Legacy es interno/i);
  });

  it("does not claim automatic plan changes", () => {
    const bodies = readSrc("src/core/components/superadmin/manual/manual-section-bodies.tsx");
    expect(bodies).toMatch(/nunca cambian el plan/i);
    expect(bodies).toMatch(/nunca debe convertirse solo/i);
    expect(bodies.toLowerCase()).not.toMatch(/cambia el plan automáticamente/);
    expect(bodies.toLowerCase()).not.toMatch(/automaticamente cambia el plan/);
  });

  it("has maintainable version metadata", () => {
    expect(SUPERADMIN_MANUAL_META.version).toBe("1.0");
    expect(SUPERADMIN_MANUAL_META.route).toBe("/superadmin/manual");
    expect(SUPERADMIN_MANUAL_META.contentUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("manual assets and source avoid production project ref and secrets", () => {
    const productionRef = "nipqdarduknydqptqzup";
    const secretHints = ["service_role", "SUPABASE_SERVICE_ROLE", "eyJhbGciOi"];
    const files = [
      "src/core/components/superadmin/manual/manual-data.ts",
      "src/core/components/superadmin/manual/manual-section-bodies.tsx",
      "src/core/components/superadmin/manual/superadmin-manual-view.tsx",
      "src/app/(dashboard)/superadmin/manual/page.tsx",
    ];
    for (const file of files) {
      const text = readSrc(file);
      expect(text).not.toContain(productionRef);
      for (const hint of secretHints) {
        expect(text).not.toContain(hint);
      }
    }

    const assetDir = path.join(ROOT, "public/superadmin-manual");
    for (const name of readdirSync(assetDir)) {
      const text = readFileSync(path.join(assetDir, name), "utf8");
      expect(text).not.toContain(productionRef);
      expect(text.toLowerCase()).not.toMatch(/dni|paciente real|historia clínica/);
      for (const hint of secretHints) {
        expect(text).not.toContain(hint);
      }
    }
  });

  it("contextual help links exist on key superadmin pages", () => {
    expect(readSrc("src/app/(dashboard)/superadmin/plans/page.tsx")).toContain('anchor="plans"');
    expect(readSrc("src/app/(dashboard)/superadmin/usage/page.tsx")).toContain('anchor="usage"');
    expect(readSrc("src/app/(dashboard)/superadmin/recommendations/page.tsx")).toContain(
      'anchor="recommendations"'
    );
    expect(readSrc("src/app/(dashboard)/superadmin/features/page.tsx")).toContain(
      'anchor="features"'
    );
    const clinic = readSrc("src/app/(dashboard)/superadmin/clinics/[clinicId]/page.tsx");
    expect(clinic).toContain('anchor="overrides"');
    expect(clinic).toContain('anchor="change-plan"');
  });
});
