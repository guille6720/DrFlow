/**
 * Phase 28 — User impact assessment tests.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  evaluateUserImpactPosture,
  getUserImpactById,
  USER_IMPACT_CATEGORIES,
  USER_IMPACT_REQUIRED_CATEGORY_IDS,
} from "@/core/compliance/user-impact";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("user-impact catalog", () => {
  it("covers all required Phase 28 categories with LOW|MEDIUM|HIGH", () => {
    expect(USER_IMPACT_CATEGORIES.map((c) => c.id).sort()).toEqual(
      [...USER_IMPACT_REQUIRED_CATEGORY_IDS].sort()
    );
    for (const c of USER_IMPACT_CATEGORIES) {
      expect(["LOW", "MEDIUM", "HIGH"]).toContain(c.level);
      expect(c.userVisibleEffects.length).toBeGreaterThan(0);
      expect(c.mitigations.length).toBeGreaterThan(0);
    }
  });

  it("rates subscription HIGH and authentication LOW", () => {
    expect(getUserImpactById("subscription")?.level).toBe("HIGH");
    expect(getUserImpactById("authentication")?.level).toBe("LOW");
    expect(getUserImpactById("database")?.level).toBe("MEDIUM");
    expect(getUserImpactById("patient_data")?.level).toBe("MEDIUM");
  });

  it("evaluateUserImpactPosture overall is HIGH when any HIGH exists", () => {
    const posture = evaluateUserImpactPosture();
    expect(posture.overallLevel).toBe("HIGH");
    expect(posture.highCount).toBeGreaterThanOrEqual(1);
    expect(posture.categoryCount).toBe(7);
  });
});

describe("USER-IMPACT-FASE-28.md", () => {
  it("reports all categories with levels", () => {
    const doc = read("docs/compliance/USER-IMPACT-FASE-28.md");
    for (const id of USER_IMPACT_REQUIRED_CATEGORY_IDS) {
      expect(doc.toLowerCase()).toContain(id.replace("_", " ").split(" ")[0]);
      expect(getUserImpactById(id)).toBeTruthy();
    }
    expect(doc).toMatch(/\*\*HIGH\*\*/);
    expect(doc).toMatch(/\*\*MEDIUM\*\*/);
    expect(doc).toMatch(/\*\*LOW\*\*/);
    expect(doc).toContain("Subscription");
    expect(doc).toContain("Database");
    expect(doc).toContain("Authentication");
    expect(doc).toContain("Clinic");
    expect(doc).toContain("Patient data");
    expect(doc).toContain("UI");
    expect(doc).toContain("API");
  });
});
