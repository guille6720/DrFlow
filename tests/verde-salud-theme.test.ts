import { describe, expect, it } from "vitest";

import {
  applyUiThemeToDocument,
  supportsClinicalDark,
  UI_STYLE_LABELS,
} from "@/core/theme/ui-theme";

describe("Four clinical palettes + dark mode", () => {
  it("labels the four approved palettes", () => {
    expect(UI_STYLE_LABELS["1"]).toMatch(/Azul Médico/i);
    expect(UI_STYLE_LABELS["2"]).toMatch(/Verde Bienestar/i);
    expect(UI_STYLE_LABELS["3"]).toMatch(/Minimalismo/i);
    expect(UI_STYLE_LABELS["4"]).toMatch(/Cálido/i);
  });

  it("supports clinical dark for every style", () => {
    expect(supportsClinicalDark("1")).toBe(true);
    expect(supportsClinicalDark("2")).toBe(true);
    expect(supportsClinicalDark("3")).toBe(true);
    expect(supportsClinicalDark("4")).toBe(true);
  });

  it("maps styles 3/4 to azure/cobalt palettes and keeps dark flag", () => {
    const root = document.documentElement;
    applyUiThemeToDocument("3", true);
    expect(root.getAttribute("data-ui-style")).toBe("2");
    expect(root.getAttribute("data-ui-palette")).toBe("azure");
    expect(root.getAttribute("data-clinical-dark")).toBe("1");

    applyUiThemeToDocument("4", false);
    expect(root.getAttribute("data-ui-palette")).toBe("cobalt");
    expect(root.getAttribute("data-clinical-dark")).toBe("0");

    applyUiThemeToDocument("1", true);
    expect(root.getAttribute("data-ui-style")).toBe("1");
    expect(root.getAttribute("data-ui-palette")).toBeNull();
    expect(root.getAttribute("data-clinical-dark")).toBe("1");

    applyUiThemeToDocument("2", false);
    expect(root.getAttribute("data-ui-style")).toBe("2");
    expect(root.getAttribute("data-ui-palette")).toBeNull();
  });

  it("defines light and dark tokens for all four palettes in globals.css", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(css).toMatch(/Azul Médico Clásico/);
    expect(css).toMatch(/Verde Bienestar/);
    expect(css).toMatch(/Minimalismo Moderno/);
    expect(css).toMatch(/Cálido y Empático/);

    expect(css).toMatch(/html\[data-ui-style="1"\]:not\(\[data-clinical-dark="1"\]\)[\s\S]*?--primary:\s*#1e3a8a/i);
    expect(css).toMatch(/html\[data-ui-style="1"\]\[data-clinical-dark="1"\][\s\S]*?--primary:\s*#3b82f6/i);

    expect(css).toMatch(/html\[data-ui-style="2"\]:not\(\[data-clinical-dark="1"\]\)[\s\S]*?--primary:\s*#059669/i);
    expect(css).toMatch(/--background:\s*#d1fae5/i);
    expect(css).toMatch(/--background:\s*#07120c/i);
    expect(css).toMatch(/--warning:\s*#f59e0b/i);

    expect(css).toMatch(/html\[data-ui-palette="azure"\]:not\(\[data-clinical-dark="1"\]\)[\s\S]*?--primary:\s*#475569/i);
    expect(css).toMatch(/html\[data-ui-palette="azure"\]:not\(\[data-clinical-dark="1"\]\)[\s\S]*?--error:\s*#ef4444/i);

    expect(css).toMatch(/html\[data-ui-palette="cobalt"\]:not\(\[data-clinical-dark="1"\]\)[\s\S]*?--primary:\s*#f97316/i);
    expect(css).toMatch(/html\[data-ui-palette="cobalt"\]:not\(\[data-clinical-dark="1"\]\)[\s\S]*?--background:\s*#fffbfe/i);
    expect(css).toMatch(/html\[data-ui-palette="cobalt"\]\[data-clinical-dark="1"\][\s\S]*?--background:\s*#061a18/i);
  });

  it("keeps button variants on CSS variable tokens", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const button = readFileSync(join(process.cwd(), "src/components/ui/button.tsx"), "utf8");
    expect(button).toMatch(/var\(--primary\)/);
    expect(button).not.toMatch(/from-cyan-500/);
  });
});
