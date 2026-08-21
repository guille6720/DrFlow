import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRatio, meetsWcagAa } from "@/core/theme/contrast";

describe("Form control readability contract", () => {
  const css = readFileSync(join(process.cwd(), "src/core/theme/form-states.css"), "utf8");

  it("covers labels, helpers, errors, required, placeholders, disabled", () => {
    for (const token of [
      ".drflow-ui-label",
      ".drflow-ui-helper",
      ".drflow-ui-error",
      ".drflow-ui-required",
      "::placeholder",
      ":disabled",
      "checkbox",
      "radio",
    ]) {
      expect(css.includes(token), `missing ${token}`).toBe(true);
    }
  });

  it("forces placeholder opacity 1", () => {
    expect(css).toMatch(/::placeholder[\s\S]*opacity:\s*1/);
  });

  it("canonical form pairs meet AA", () => {
    const pairs = [
      ["#0F172A", "#FFFFFF"],
      ["#334155", "#FFFFFF"],
      ["#64748B", "#FFFFFF"],
      ["#475569", "#FFFFFF"],
      ["#B91C1C", "#FFFFFF"],
      ["#F8FAFC", "#0A1D36"],
      ["#CBD5E1", "#102845"],
      ["#94A3B8", "#0A1D36"],
      ["#F87171", "#102845"],
      ["#475569", "#F1F5F9"],
    ] as const;
    for (const [fg, bg] of pairs) {
      expect(meetsWcagAa(fg, bg, "text"), `${fg} on ${bg} = ${contrastRatio(fg, bg).toFixed(2)}`).toBe(
        true
      );
    }
  });

  it("is imported from globals.css", () => {
    const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(globals).toContain("theme/form-states.css");
  });
});
