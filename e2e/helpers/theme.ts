/**
 * Theme helpers for a11y E2E — keep self-contained (no @/ imports)
 * so Playwright resolves without the Next app path alias.
 */

import type { Page } from "@playwright/test";

export type UiStyleId = "clinical-blue" | "medical-slate";

export type ThemeFixture = {
  id: string;
  style: UiStyleId;
  clinicalDark: boolean;
};

export const UI_STYLE_IDS: UiStyleId[] = ["clinical-blue", "medical-slate"];

/** Official palettes × light/dark. */
export const ALL_APP_THEMES: ThemeFixture[] = UI_STYLE_IDS.flatMap((style) => [
  { id: `${style}-dark`, style, clinicalDark: true },
  { id: `${style}-light`, style, clinicalDark: false },
]);

export async function applyAppTheme(page: Page, theme: ThemeFixture): Promise<void> {
  await page.addInitScript(
    ({ style, clinicalDark }) => {
      try {
        localStorage.setItem("drflow-ui-style", style);
        localStorage.setItem("drflow-clinical-dark", clinicalDark ? "1" : "0");
        localStorage.setItem("drflow-appearance-mode", clinicalDark ? "dark" : "light");
      } catch {
        /* ignore */
      }
    },
    { style: theme.style, clinicalDark: theme.clinicalDark }
  );

  await page.evaluate(
    ({ style, clinicalDark }) => {
      const root = document.documentElement;
      root.setAttribute("data-ui-style", "2");
      root.setAttribute("data-ui-palette", style);
      root.setAttribute("data-clinical-dark", clinicalDark ? "1" : "0");
      root.style.colorScheme = clinicalDark ? "dark" : "light";
      try {
        localStorage.setItem("drflow-ui-style", style);
        localStorage.setItem("drflow-clinical-dark", clinicalDark ? "1" : "0");
        localStorage.setItem("drflow-appearance-mode", clinicalDark ? "dark" : "light");
      } catch {
        /* ignore */
      }
    },
    { style: theme.style, clinicalDark: theme.clinicalDark }
  );
}
