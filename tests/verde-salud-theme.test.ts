import { describe, expect, it } from "vitest";

import {
  applyUiThemeToDocument,
  DEFAULT_UI_STYLE,
  readUiStyleFromStorage,
  supportsClinicalDark,
  UI_STYLE_LABEL,
} from "@/core/theme/ui-theme";

describe("Single teal clinical theme + dark mode", () => {
  it("exposes a single teal theme label", () => {
    expect(UI_STYLE_LABEL).toMatch(/Teal/i);
  });

  it("always resolves to the unique clinical style", () => {
    expect(readUiStyleFromStorage()).toBe(DEFAULT_UI_STYLE);
    expect(supportsClinicalDark()).toBe(true);
  });

  it("applies style 2 without palette and honors dark flag", () => {
    const root = document.documentElement;
    applyUiThemeToDocument(DEFAULT_UI_STYLE, true);
    expect(root.getAttribute("data-ui-style")).toBe("2");
    expect(root.getAttribute("data-ui-palette")).toBeNull();
    expect(root.getAttribute("data-clinical-dark")).toBe("1");

    applyUiThemeToDocument(DEFAULT_UI_STYLE, false);
    expect(root.getAttribute("data-clinical-dark")).toBe("0");
    expect(root.getAttribute("data-ui-palette")).toBeNull();
  });

  it("defines teal light and dark tokens in globals.css", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(css).toMatch(/Teal clínico/);
    expect(css).toMatch(/--primary:\s*#0d9488/i);
    expect(css).toMatch(/--sidebar-active-bg:\s*#0d9488/i);
    expect(css).toMatch(/--background:\s*#f8fafc/i);
    expect(css).toMatch(/--background:\s*#0b1413/i);
    expect(css).toMatch(/--primary:\s*#2dd4bf/i);
    expect(css).toMatch(/--warning:\s*#f59e0b/i);
  });

  it("keeps button variants on CSS variable tokens", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const button = readFileSync(join(process.cwd(), "src/components/ui/button.tsx"), "utf8");
    expect(button).toMatch(/var\(--primary\)/);
    expect(button).not.toMatch(/from-cyan-500/);
  });
});
