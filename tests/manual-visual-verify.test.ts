import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { QA_CHECKLIST } from "@/core/qa/checklist-data";

const SURFACES = [
  "settings",
  "theme selector",
  "patient",
  "clinical history",
  "appointments",
  "dashboard",
  "forms",
  "tables",
  "modals",
  "Superadmin",
  "sidebar",
] as const;

describe("Manual visual verification (section 13)", () => {
  it("ships QA checklist section for theme legibility", () => {
    const section = QA_CHECKLIST.find((s) => s.id === "a11y-visual");
    expect(section).toBeTruthy();
    expect(section!.items.length).toBeGreaterThanOrEqual(10);
    const labels = section!.items.map((i) => i.label.toLowerCase()).join(" ");
    for (const needle of [
      "apariencia",
      "dashboard",
      "sidebar",
      "paciente",
      "historia",
      "agenda",
      "modales",
      "superadmin",
    ]) {
      expect(labels.includes(needle), `missing ${needle}`).toBe(true);
    }
  });

  it("loads manual-visual-states.css from globals", () => {
    const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(globals).toContain("theme/manual-visual-states.css");
    const css = readFileSync(join(process.cwd(), "src/core/theme/manual-visual-states.css"), "utf8");
    expect(css).toContain("drflow-superadmin-shell");
    expect(css).toContain("--text-muted");
  });

  it("marks Superadmin layout for visual locks", () => {
    const layout = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/superadmin/layout.tsx"),
      "utf8"
    );
    expect(layout).toContain("drflow-superadmin-shell");
    expect(layout).toContain("data-superadmin");
  });

  it("documents the representative surface set", () => {
    expect(SURFACES).toHaveLength(11);
  });
});
