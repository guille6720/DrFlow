import { describe, expect, it } from "vitest";

import { UI_STYLE_LABELS } from "@/core/theme/ui-theme";

describe("Verde Salud theme (Estilo 2)", () => {
  it("labels Estilo 2 as Verde Salud", () => {
    expect(UI_STYLE_LABELS["2"]).toMatch(/Verde Salud/i);
  });

  it("defines Verde Salud light and dark tokens in globals.css", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/Verde Salud/);
    expect(css).toMatch(/--primary:\s*#16a34a/i);
    expect(css).toMatch(/--background:\s*#f8faf9/i);
    expect(css).toMatch(/--background:\s*#07120c/i);
    expect(css).toMatch(/--sidebar-active-bg:\s*#dcfce7/i);
    expect(css).toMatch(/--error:\s*#ef4444/i);
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
