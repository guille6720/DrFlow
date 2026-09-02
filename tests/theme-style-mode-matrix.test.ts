import { describe, expect, it } from "vitest";

import { contrastRatio, meetsWcagAa } from "@/core/theme/contrast";
import { UI_STYLE_IDS, UI_STYLE_LABELS, type UiStyleId } from "@/core/theme/ui-theme";

/**
 * Canonical readable pairs per official palette × mode.
 */
const STYLE_MODE_PAIRS: Array<{
  style: UiStyleId;
  mode: "light" | "dark";
  primary: { fg: string; bg: string };
  secondary: { fg: string; bg: string };
  muted: { fg: string; bg: string };
}> = [
  {
    style: "clinical-blue",
    mode: "light",
    primary: { fg: "#172033", bg: "#F6F9FC" },
    secondary: { fg: "#667085", bg: "#FFFFFF" },
    muted: { fg: "#667085", bg: "#F6F9FC" },
  },
  {
    style: "clinical-blue",
    mode: "dark",
    primary: { fg: "#F3F7FC", bg: "#08111F" },
    secondary: { fg: "#AAB7C8", bg: "#101B2D" },
    muted: { fg: "#AAB7C8", bg: "#101B2D" },
  },
  {
    style: "medical-slate",
    mode: "light",
    primary: { fg: "#182230", bg: "#F7F8FA" },
    secondary: { fg: "#667085", bg: "#FFFFFF" },
    muted: { fg: "#667085", bg: "#F7F8FA" },
  },
  {
    style: "medical-slate",
    mode: "dark",
    primary: { fg: "#F4F6F8", bg: "#0D1117" },
    secondary: { fg: "#A7B0BE", bg: "#161B22" },
    muted: { fg: "#A7B0BE", bg: "#161B22" },
  },
];

describe("Style × light/dark text contrast matrix", () => {
  it("covers every active UiStyleId in both modes", () => {
    for (const id of UI_STYLE_IDS) {
      expect(STYLE_MODE_PAIRS.some((p) => p.style === id && p.mode === "light")).toBe(true);
      expect(STYLE_MODE_PAIRS.some((p) => p.style === id && p.mode === "dark")).toBe(true);
      expect(UI_STYLE_LABELS[id]).toBeTruthy();
    }
  });

  for (const row of STYLE_MODE_PAIRS) {
    const label = `${UI_STYLE_LABELS[row.style]} / ${row.mode}`;
    it(`${label}: primary ≥ 4.5`, () => {
      expect(meetsWcagAa(row.primary.fg, row.primary.bg, "text")).toBe(true);
    });
    it(`${label}: secondary ≥ 4.5`, () => {
      expect(meetsWcagAa(row.secondary.fg, row.secondary.bg, "text")).toBe(true);
    });
    it(`${label}: muted ≥ 4.5 (ratio ${contrastRatio(row.muted.fg, row.muted.bg).toFixed(2)})`, () => {
      expect(meetsWcagAa(row.muted.fg, row.muted.bg, "text")).toBe(true);
    });
  }
});
