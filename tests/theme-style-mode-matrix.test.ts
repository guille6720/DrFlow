import { describe, expect, it } from "vitest";

import { contrastRatio, meetsWcagAa } from "@/core/theme/contrast";
import { UI_STYLE_IDS, UI_STYLE_LABELS, type UiStyleId } from "@/core/theme/ui-theme";

/**
 * Canonical readable pairs per Style × mode used by semantic-tokens.css.
 * Keep identities distinct; only assert WCAG floors.
 */
const STYLE_MODE_PAIRS: Array<{
  style: UiStyleId;
  mode: "light" | "dark";
  primary: { fg: string; bg: string };
  secondary: { fg: string; bg: string };
  muted: { fg: string; bg: string };
}> = [
  {
    style: "2",
    mode: "light",
    primary: { fg: "#0F172A", bg: "#F8FAFC" },
    secondary: { fg: "#334155", bg: "#FFFFFF" },
    muted: { fg: "#475569", bg: "#F8FAFC" },
  },
  {
    style: "2",
    mode: "dark",
    primary: { fg: "#F8FAFC", bg: "#0F172A" },
    secondary: { fg: "#CBD5E1", bg: "#1E293B" },
    muted: { fg: "#A8B6C8", bg: "#1E293B" },
  },
  {
    style: "3",
    mode: "light",
    primary: { fg: "#0F172A", bg: "#E8F2FC" },
    secondary: { fg: "#334155", bg: "#FFFFFF" },
    muted: { fg: "#475569", bg: "#E8F2FC" },
  },
  {
    style: "3",
    mode: "dark",
    primary: { fg: "#F8FAFC", bg: "#0A1628" },
    secondary: { fg: "#CBD5E1", bg: "#102845" },
    muted: { fg: "#A8B6C8", bg: "#102845" },
  },
  {
    style: "4",
    mode: "light",
    primary: { fg: "#FFFFFF", bg: "#2563EB" },
    secondary: { fg: "#F1F5F9", bg: "#2563EB" },
    muted: { fg: "#EFF6FF", bg: "#2563EB" },
  },
  {
    style: "4",
    mode: "dark",
    primary: { fg: "#F8FAFC", bg: "#1E3A8A" },
    secondary: { fg: "#F1F5F9", bg: "#1E3A8A" },
    muted: { fg: "#E2E8F0", bg: "#1E3A8A" },
  },
  {
    style: "5",
    mode: "light",
    primary: { fg: "#0F172A", bg: "#F9FAFB" },
    secondary: { fg: "#334155", bg: "#FFFFFF" },
    muted: { fg: "#475569", bg: "#F9FAFB" },
  },
  {
    style: "5",
    mode: "dark",
    primary: { fg: "#F8FAFC", bg: "#0F1720" },
    secondary: { fg: "#CBD5E1", bg: "#1A2430" },
    muted: { fg: "#A8B6C8", bg: "#1A2430" },
  },
  {
    style: "6",
    mode: "light",
    primary: { fg: "#0F172A", bg: "#E8EEF6" },
    secondary: { fg: "#334155", bg: "#FFFFFF" },
    muted: { fg: "#475569", bg: "#E8EEF6" },
  },
  {
    style: "6",
    mode: "dark",
    primary: { fg: "#F8FAFC", bg: "#07182D" },
    secondary: { fg: "#CBD5E1", bg: "#102845" },
    muted: { fg: "#A8B6C8", bg: "#102845" },
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
