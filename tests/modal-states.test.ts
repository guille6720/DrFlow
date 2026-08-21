import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRatio, meetsWcagAa } from "@/core/theme/contrast";

describe("Modal / overlay readability", () => {
  const css = readFileSync(join(process.cwd(), "src/core/theme/modal-states.css"), "utf8");
  const midnight = readFileSync(join(process.cwd(), "src/core/theme/midnight-navy.css"), "utf8");

  it("defines light modal panel locks", () => {
    for (const needle of [
      "drflow-modal-panel",
      "drflow-workspace-overlay-panel",
      "drflow-modal-subtitle",
      "drflow-modal-footnote",
      "drflow-modal-close",
      "drflow-theme-option",
    ]) {
      expect(css.includes(needle), `missing ${needle}`).toBe(true);
    }
  });

  it("excludes light panels from Midnight dialog popover remap", () => {
    expect(midnight).toContain("drflow-modal-panel");
    expect(midnight).toContain("drflow-workspace-overlay-panel");
    expect(midnight).toMatch(
      /\[role="dialog"\]:not\(\.drflow-modal-panel\)/
    );
  });

  it("canonical light-modal pairs meet AA", () => {
    const pairs = [
      ["#0F172A", "#FFFFFF"],
      ["#334155", "#FFFFFF"],
      ["#475569", "#FFFFFF"],
      ["#0F172A", "#ECFDF5"],
      ["#64748B", "#FFFFFF"],
    ] as const;
    for (const [fg, bg] of pairs) {
      expect(meetsWcagAa(fg, bg, "text"), `${fg} on ${bg} = ${contrastRatio(fg, bg).toFixed(2)}`).toBe(
        true
      );
    }
  });

  it("is imported from globals.css", () => {
    const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(globals).toContain("theme/modal-states.css");
  });
});
