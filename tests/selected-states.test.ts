import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRatio, meetsWcagAa } from "@/core/theme/contrast";

describe("Selected state readability", () => {
  const css = readFileSync(join(process.cwd(), "src/core/theme/selected-states.css"), "utf8");

  it("covers theme cards, tabs, sidebar, rows, ehr active", () => {
    for (const needle of [
      "drflow-theme-option",
      "drflow-patient-workspace-tab-active",
      "sidebar",
      "table-hover",
      "drflow-ehr-sidebar-active",
      "aria-selected",
      "data-selected",
      "aria-pressed",
    ]) {
      expect(css.includes(needle), `missing ${needle}`).toBe(true);
    }
  });

  it("locks pale selected surfaces to dark ink pairs", () => {
    const pairs = [
      ["#0F172A", "#ECFDF5"],
      ["#0F172A", "#E0F2FE"],
      ["#0F172A", "#DBEAFE"],
      ["#0F172A", "#EFF6FF"],
      ["#0F172A", "#CCFBF1"],
      ["#1D4ED8", "#EFF6FF"],
      ["#FFFFFF", "#0F766E"],
      ["#F8FAFC", "#134E4A"],
    ] as const;
    for (const [fg, bg] of pairs) {
      expect(meetsWcagAa(fg, bg, "text"), `${fg} on ${bg} = ${contrastRatio(fg, bg).toFixed(2)}`).toBe(
        true
      );
    }
  });

  it("is imported from globals.css", () => {
    const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(globals).toContain("theme/selected-states.css");
  });
});
