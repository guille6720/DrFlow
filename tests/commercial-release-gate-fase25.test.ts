/**
 * Phase 25 — Commercial release gate catalog & wiring tests.
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  COMMERCIAL_GATE_REQUIRED_TEST_FILES,
  COMMERCIAL_RELEASE_GATE_ITEMS,
  COMMERCIAL_TECHNICAL_BLOCKER_CONDITIONS,
  evaluateCommercialReleasePosture,
  listExternalActionItems,
  listTechnicalBlockerItems,
} from "@/core/compliance/commercial-release-gate";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("commercial-release-gate catalog", () => {
  it("uses the four required categories", () => {
    const cats = new Set(COMMERCIAL_RELEASE_GATE_ITEMS.map((i) => i.category));
    expect(cats.has("PASS")).toBe(true);
    expect(cats.has("WARNING")).toBe(true);
    expect(cats.has("BLOCKER") || listTechnicalBlockerItems().length > 0).toBe(true);
    expect(cats.has("EXTERNAL ACTION REQUIRED")).toBe(true);
  });

  it("defines technical blockers for the seven minimum conditions", () => {
    expect(COMMERCIAL_TECHNICAL_BLOCKER_CONDITIONS).toHaveLength(7);
    expect(listTechnicalBlockerItems().length).toBeGreaterThanOrEqual(7);
    expect(
      listTechnicalBlockerItems().every((i) => i.technicalBlockerIfFail === true)
    ).toBe(true);
  });

  it("keeps external legal items separate (not technicalBlockerIfFail)", () => {
    const external = listExternalActionItems();
    expect(external.length).toBeGreaterThanOrEqual(3);
    expect(external.every((i) => i.technicalBlockerIfFail === false)).toBe(true);
    expect(external.some((i) => i.id === "aaip_registration")).toBe(true);
    expect(external.some((i) => i.id === "arca_invoicing")).toBe(true);
  });

  it("evaluateCommercialReleasePosture points at script and doc", () => {
    const posture = evaluateCommercialReleasePosture();
    expect(posture.automatedGateScript).toBe("scripts/commercial-release-gate.mjs");
    expect(posture.documentation).toContain("MONETIZATION-GATE.md");
    expect(posture.technicalBlockerCount).toBeGreaterThanOrEqual(7);
  });

  it("required vitest files exist", () => {
    for (const file of COMMERCIAL_GATE_REQUIRED_TEST_FILES) {
      expect(existsSync(resolve(ROOT, file)), file).toBe(true);
    }
  });
});

describe("fase 25 wiring (static)", () => {
  it("MONETIZATION-GATE.md separates BLOCKER vs EXTERNAL", () => {
    const doc = read("docs/compliance/MONETIZATION-GATE.md");
    expect(doc).toContain("PASS");
    expect(doc).toContain("WARNING");
    expect(doc).toContain("BLOCKER");
    expect(doc).toContain("EXTERNAL ACTION REQUIRED");
    expect(doc).toContain("npm run commercial:gate");
    expect(doc).toMatch(/Separación importante|EXTERNAL ACTION REQUIRED/);
  });

  it("commercial-release-gate.mjs fails on blocker tests and lists external", () => {
    const script = read("scripts/commercial-release-gate.mjs");
    expect(script).toContain("vitest");
    expect(script).toContain("EXTERNAL ACTION REQUIRED");
    expect(script).toContain("tenant-isolation-fase10");
    expect(script).toContain("monetization-security-fase19");
    expect(script).toContain("sanitize-clinical-ai-input");
    expect(script).toContain("do not fail this script");
    expect(script).toMatch(/EXTERNAL_ACTIONS[\s\S]*ARCA/);
    expect(script).toMatch(/EXTERNAL_ACTIONS[\s\S]*AAIP/);
  });

  it("package.json exposes commercial:gate", () => {
    const pkg = read("package.json");
    expect(pkg).toContain('"commercial:gate"');
    expect(pkg).toContain("commercial-release-gate.mjs");
  });
});
