import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  SEMANTIC_PALETTE_IDS,
  SEMANTIC_TOKEN_CSS_VARS,
  semanticVar,
} from "@/core/theme/semantic-tokens";

const cssPath = join(process.cwd(), "src/core/theme/semantic-tokens.css");
const css = readFileSync(cssPath, "utf8");

describe("DrFlow semantic tokens contract", () => {
  it("defines every required CSS variable at least once", () => {
    for (const token of SEMANTIC_TOKEN_CSS_VARS) {
      expect(css.includes(`${token}:`), `missing ${token} in semantic-tokens.css`).toBe(true);
    }
  });

  it("covers every palette id in CSS selectors", () => {
    expect(css).toContain('data-ui-style="2"');
    expect(css).toContain('data-ui-palette="azure"');
    expect(css).toContain('data-ui-palette="cobalt"');
    expect(css).toContain('data-ui-palette="clinicsoft"');
    expect(css).toContain('data-ui-palette="midnight"');
    expect(SEMANTIC_PALETTE_IDS).toEqual(
      expect.arrayContaining(["clinical", "azure", "cobalt", "clinicsoft", "midnight"])
    );
  });

  it("exposes semanticVar helpers as CSS var() strings", () => {
    expect(semanticVar.textPrimary).toBe("var(--text-primary)");
    expect(semanticVar.surfaceCard).toBe("var(--surface-card)");
    expect(semanticVar.borderStrong).toBe("var(--border-strong)");
  });

  it("is imported from globals.css", () => {
    const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(globals).toContain('theme/semantic-tokens.css');
  });
});
