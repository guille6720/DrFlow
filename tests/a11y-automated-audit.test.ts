import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  meetsWcagAa,
  THEME_CONTRAST_PAIRS,
} from "@/core/theme/contrast";
import { SEMANTIC_PALETTE_IDS } from "@/core/theme/semantic-tokens";
import { UI_STYLE_IDS } from "@/core/theme/ui-theme";

/**
 * Unit-side half of section 12 automated audit:
 * - every theme style id is known
 * - every semantic palette is covered by contrast pairs
 * - canonical pairs stay AA (mirrors e2e axe/color-contrast intent)
 */
describe("Automated a11y audit contract (unit)", () => {
  it("covers every clinical UI style id", () => {
    expect(UI_STYLE_IDS.sort()).toEqual(["2", "3", "4", "5", "6"]);
  });

  it("covers every semantic palette id", () => {
    expect([...SEMANTIC_PALETTE_IDS].sort()).toEqual(
      ["azure", "clinicsoft", "clinical", "cobalt", "midnight"].sort()
    );
  });

  it("ships contrast pairs for each palette family", () => {
    const ids = THEME_CONTRAST_PAIRS.map((p) => p.id).join(" ");
    for (const needle of ["s2-", "mn-", "sc-", "az-", "co-", "form-", "sel-"]) {
      expect(ids.includes(needle), `missing pairs for ${needle}`).toBe(true);
    }
  });

  it("all THEME_CONTRAST_PAIRS meet their WCAG floor", () => {
    for (const pair of THEME_CONTRAST_PAIRS) {
      const role = pair.role ?? (pair.large ? "largeText" : "text");
      expect(
        meetsWcagAa(pair.fg, pair.bg, role),
        `${pair.id} ${contrastRatio(pair.fg, pair.bg).toFixed(2)}`
      ).toBe(true);
    }
  });

  it("documents Playwright a11y harness files", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = process.cwd();
    for (const rel of [
      "e2e/a11y-theme-audit.spec.ts",
      "e2e/helpers/a11y.ts",
      "e2e/helpers/theme.ts",
      "playwright.config.ts",
    ]) {
      expect(existsSync(join(root, rel)), rel).toBe(true);
    }
    const config = readFileSync(join(root, "playwright.config.ts"), "utf8");
    expect(config).toContain("a11y-desktop");
    expect(config).toContain("a11y-tablet");
    expect(config).toContain("a11y-mobile");
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.devDependencies?.["@axe-core/playwright"]).toBeTruthy();
    expect(pkg.scripts?.["test:e2e:a11y"]).toContain("a11y-");
  });
});
