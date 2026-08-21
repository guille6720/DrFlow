import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Clinical typography policy", () => {
  const css = readFileSync(join(process.cwd(), "src/core/theme/typography-states.css"), "utf8");
  const formCss = readFileSync(join(process.cwd(), "src/core/theme/form-states.css"), "utf8");
  const a11yLayers = [
    "a11y-contrast.css",
    "button-states.css",
    "form-states.css",
    "selected-states.css",
    "modal-states.css",
  ].map((name) => ({
    name,
    css: readFileSync(join(process.cwd(), "src/core/theme", name), "utf8"),
  }));

  it("defines clinical weight tokens", () => {
    for (const token of [
      "--font-weight-body",
      "--font-weight-label",
      "--font-weight-heading",
      "--font-weight-button",
    ]) {
      expect(css.includes(token), `missing ${token}`).toBe(true);
    }
  });

  it("keeps baseline in recommended ranges", () => {
    expect(css).toMatch(/--font-weight-body:\s*400/);
    expect(css).toMatch(/--font-weight-label:\s*500/);
    expect(css).toMatch(/--font-weight-heading:\s*600/);
    expect(css).toMatch(/--font-weight-button:\s*500/);
  });

  it("disables text-shadow contrast hacks on clinical surfaces", () => {
    expect(css).toMatch(/\.drflow-mesh[\s\S]*text-shadow:\s*none/);
    expect(css).toMatch(/\.drflow-modal-panel[\s\S]*text-shadow:\s*none/);
  });

  it("does not globally force bold in a11y color layers", () => {
    for (const layer of a11yLayers) {
      const forcedBold = /font-weight:\s*(7|8|9)00\s*!important/;
      expect(forcedBold.test(layer.css), `${layer.name} forces heavy weight`).toBe(false);
    }
  });

  it("keeps required marker at heading weight, not ultra-bold", () => {
    expect(formCss).toMatch(/\.drflow-ui-required[\s\S]*font-weight:\s*600/);
    expect(formCss).not.toMatch(/\.drflow-ui-required[\s\S]*font-weight:\s*700/);
  });

  it("is imported from globals.css", () => {
    const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(globals).toContain("theme/typography-states.css");
  });
});
