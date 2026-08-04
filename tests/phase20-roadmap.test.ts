import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  ENTERPRISE_PHASES,
  ENTERPRISE_PHASE_COUNT,
  getCompletedPhases,
  isEnterpriseRoadmapComplete,
} from "@/lib/enterprise/phases";

describe("enterprise roadmap registry", () => {
  it("defines exactly 20 phases", () => {
    expect(ENTERPRISE_PHASE_COUNT).toBe(20);
    expect(ENTERPRISE_PHASES).toHaveLength(20);
    expect(ENTERPRISE_PHASES.map((p) => p.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1)
    );
  });

  it("marks roadmap as complete", () => {
    expect(isEnterpriseRoadmapComplete()).toBe(true);
    expect(getCompletedPhases().length).toBeGreaterThanOrEqual(18);
  });

  it("includes key enterprise migrations in phases 9-16", () => {
    const migrations = ENTERPRISE_PHASES.flatMap((p) => p.migrations ?? []);
    expect(migrations).toContain("049_plugins_phase13.sql");
    expect(migrations).toContain("052_observability_phase16.sql");
  });

  it("documents phase 20 closure", () => {
    const phase20 = ENTERPRISE_PHASES.find((p) => p.id === 20);
    expect(phase20?.slug).toBe("roadmap");
    expect(phase20?.status).toBe("completed");
    expect(phase20?.docs).toContain("docs/ENTERPRISE_TRANSFORMATION.md");
  });
});

describe("enterprise transformation documentation", () => {
  it("exists and covers all phases", () => {
    const path = resolve("docs/ENTERPRISE_TRANSFORMATION.md");
    expect(existsSync(path)).toBe(true);
    const doc = readFileSync(path, "utf8");
    expect(doc).toMatch(/Roadmap completado/);
    expect(doc).toMatch(/Regla rectora/);
    for (let n = 1; n <= 20; n++) {
      expect(doc).toMatch(new RegExp(`Fase ${n}`));
    }
  });

  it("links to testing and production runbooks", () => {
    const doc = readFileSync(resolve("docs/ENTERPRISE_TRANSFORMATION.md"), "utf8");
    expect(doc).toContain("TESTING.md");
    expect(doc).toContain("PRODUCTION.md");
  });

  it("includes enterprise status script", () => {
    const script = readFileSync(resolve("scripts/enterprise-status.mjs"), "utf8");
    expect(script).toMatch(/20 fases/);
  });
});

describe("phase delivery protocol (Fase 20 meta)", () => {
  it("documents the 7-step completion checklist", () => {
    const doc = readFileSync(resolve("docs/ENTERPRISE_TRANSFORMATION.md"), "utf8");
    expect(doc).toMatch(/npm test/);
    expect(doc).toMatch(/Commit lógico/);
    expect(doc).toMatch(/Migración remota/);
  });
});
