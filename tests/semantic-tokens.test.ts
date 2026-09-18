import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  SEMANTIC_PALETTE_IDS,
  SEMANTIC_TOKEN_CSS_VARS,
  semanticVar,
} from "@/core/theme/semantic-tokens";

const cssPath = join(process.cwd(), "src/core/theme/official-palettes.css");
const css = readFileSync(cssPath, "utf8");
const semanticCss = readFileSync(join(process.cwd(), "src/core/theme/semantic-tokens.css"), "utf8");

describe("NexClinic semantic tokens contract", () => {
  it("defines every required CSS variable at least once", () => {
    const combined = `${css}\n${semanticCss}`;
    for (const token of SEMANTIC_TOKEN_CSS_VARS) {
      expect(combined.includes(`${token}:`), `missing ${token}`).toBe(true);
    }
  });

  it("covers every official palette id in CSS selectors", () => {
    expect(css).toContain('data-ui-palette="clinical-blue"');
    expect(css).toContain('data-ui-palette="medical-slate"');
    expect(SEMANTIC_PALETTE_IDS).toEqual(
      expect.arrayContaining(["clinical-blue", "medical-slate"])
    );
    expect(SEMANTIC_PALETTE_IDS).toHaveLength(2);
  });

  it("exposes semanticVar helpers as CSS var() strings", () => {
    expect(semanticVar.textPrimary).toBe("var(--text-primary)");
    expect(semanticVar.surfaceCard).toBe("var(--surface-card)");
    expect(semanticVar.borderStrong).toBe("var(--border-strong)");
  });

  it("is imported from globals.css", () => {
    const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(globals).toContain("theme/official-palettes.css");
    expect(globals).toContain("theme/semantic-tokens.css");
  });
});
