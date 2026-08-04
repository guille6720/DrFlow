import { describe, expect, it } from "vitest";
import {
  WCAG_AA_FEATURES,
  APP_KEYBOARD_SHORTCUTS,
  REDUCED_MOTION_STORAGE_KEY,
} from "@/lib/accessibility/constants";
import { getFocusableElements } from "@/lib/accessibility/focus";

describe("accessibility constants", () => {
  it("defines WCAG AA feature checklist", () => {
    expect(WCAG_AA_FEATURES.length).toBeGreaterThanOrEqual(6);
    expect(WCAG_AA_FEATURES.some((f) => f.id === "skip-link")).toBe(true);
    expect(WCAG_AA_FEATURES.some((f) => f.id === "focus-visible")).toBe(true);
  });

  it("lists keyboard shortcuts including command palette", () => {
    expect(APP_KEYBOARD_SHORTCUTS.some((s) => s.keys.includes("Ctrl+K"))).toBe(true);
    expect(APP_KEYBOARD_SHORTCUTS.some((s) => s.keys.includes("Esc"))).toBe(true);
  });

  it("uses stable reduced motion storage key", () => {
    expect(REDUCED_MOTION_STORAGE_KEY).toBe("drflow-a11y-reduced-motion");
  });
});

describe("getFocusableElements", () => {
  it("returns focusable elements in DOM order", () => {
    document.body.innerHTML = `
      <div id="root">
        <button type="button">A</button>
        <a href="/b">B</a>
        <button type="button" disabled>D</button>
        <input type="text" />
      </div>
    `;
    const root = document.getElementById("root")!;
    const focusable = getFocusableElements(root);
    expect(focusable).toHaveLength(3);
    expect(focusable[0]?.textContent).toBe("A");
    expect(focusable[1]?.textContent).toBe("B");
  });
});

describe("accessibility global styles", () => {
  it("includes skip link and sr-only utilities", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\.drflow-skip-link/);
    expect(css).toMatch(/\.sr-only/);
    expect(css).toMatch(/prefers-reduced-motion/);
    expect(css).toMatch(/:focus-visible/);
  });
});
