import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRatio, meetsWcagAa } from "@/core/theme/contrast";

describe("Button state contrast contract", () => {
  const css = readFileSync(join(process.cwd(), "src/core/theme/button-states.css"), "utf8");

  it("locks primary label color on hover/active/loading/disabled", () => {
    expect(css).toContain(".drflow-ui-button.drflow-btn-primary:hover");
    expect(css).toContain(".drflow-ui-button.drflow-btn-primary:active");
    expect(css).toContain(".drflow-ui-button.drflow-btn-primary[aria-busy=\"true\"]");
    expect(css).toContain(".drflow-ui-button.drflow-btn-primary:disabled");
    expect(css).toMatch(/drflow-btn-primary:hover[\s\S]*text-on-primary/);
  });

  it("never uses opacity to fade disabled/loading button chrome", () => {
    expect(css).toMatch(/\[aria-busy="true"\][\s\S]*opacity:\s*1/);
    expect(css).toMatch(/:disabled:not\(\[aria-busy="true"\]\)[\s\S]*opacity:\s*1/);
  });

  it("covers ghost/outline/secondary/danger states", () => {
    for (const v of ["ghost", "outline", "secondary", "danger"]) {
      expect(css).toContain(`.drflow-btn-${v}`);
    }
  });

  it("canonical default/hover pairs remain AA", () => {
    const pairs = [
      ["#FFFFFF", "#0F4C5C"],
      ["#FFFFFF", "#0C3D4A"],
      ["#061426", "#5CB8F6"],
      ["#061426", "#3AA0E8"],
      ["#1D4ED8", "#FFFFFF"],
      ["#1E40AF", "#EFF6FF"],
      ["#FFFFFF", "#0F766E"],
      ["#FFFFFF", "#115E59"],
    ] as const;
    for (const [fg, bg] of pairs) {
      expect(meetsWcagAa(fg, bg, "text"), `${fg} on ${bg} = ${contrastRatio(fg, bg).toFixed(2)}`).toBe(
        true
      );
    }
  });

  it("is imported from globals.css", () => {
    const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(globals).toContain("theme/button-states.css");
  });
});
