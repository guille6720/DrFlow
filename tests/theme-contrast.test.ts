import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  meetsWcagAa,
  THEME_CONTRAST_PAIRS,
} from "@/core/theme/contrast";

describe("DrFlow theme contrast (WCAG AA)", () => {
  for (const pair of THEME_CONTRAST_PAIRS) {
    it(`${pair.id}: ${pair.fg} on ${pair.bg} ≥ ${pair.large ? "3" : "4.5"}:1`, () => {
      const ratio = contrastRatio(pair.fg, pair.bg);
      expect(
        meetsWcagAa(pair.fg, pair.bg, pair.large),
        `${pair.id} ratio ${ratio.toFixed(2)}`
      ).toBe(true);
    });
  }
});
