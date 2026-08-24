import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  type ContrastRole,
  meetsWcagAa,
  requiredRatio,
  THEME_CONTRAST_PAIRS,
} from "@/core/theme/contrast";

function pairRole(pair: (typeof THEME_CONTRAST_PAIRS)[number]): ContrastRole {
  if (pair.role) return pair.role;
  if (pair.large) return "largeText";
  return "text";
}

describe("DrFlow theme contrast (WCAG AA)", () => {
  for (const pair of THEME_CONTRAST_PAIRS) {
    const role = pairRole(pair);
    const need = requiredRatio(role);
    it(`${pair.id}: ${pair.fg} on ${pair.bg} ≥ ${need}:1 (${role})`, () => {
      const ratio = contrastRatio(pair.fg, pair.bg);
      expect(
        meetsWcagAa(pair.fg, pair.bg, role),
        `${pair.id} ratio ${ratio.toFixed(2)} (need ${need})`
      ).toBe(true);
    });
  }

  it("policy: normal text floor is 4.5 and UI non-text floor is 3", () => {
    expect(requiredRatio("text")).toBe(4.5);
    expect(requiredRatio("largeText")).toBe(3);
    expect(requiredRatio("ui")).toBe(3);
  });
});
