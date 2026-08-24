/**
 * Theme helpers for a11y E2E — keep self-contained (no @/ imports)
 * so Playwright resolves without the Next app path alias.
 */

import type { Page } from "@playwright/test";

export type UiStyleId = "2" | "3" | "4" | "5" | "6";

export type ThemeFixture = {
  id: string;
  style: UiStyleId;
  clinicalDark: boolean;
};

export const UI_STYLE_IDS: UiStyleId[] = ["6", "2", "3", "4", "5"];

/** Every clinical app theme (styles 2–6) × light/dark. */
export const ALL_APP_THEMES: ThemeFixture[] = UI_STYLE_IDS.flatMap((style) => [
  { id: `style-${style}-dark`, style, clinicalDark: true },
  { id: `style-${style}-light`, style, clinicalDark: false },
]);

export async function applyAppTheme(page: Page, theme: ThemeFixture): Promise<void> {
  await page.addInitScript(
    ({ style, clinicalDark }) => {
      try {
        localStorage.setItem("drflow-ui-style", style);
        localStorage.setItem("drflow-clinical-dark", clinicalDark ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    { style: theme.style, clinicalDark: theme.clinicalDark }
  );

  await page.evaluate(
    ({ style, clinicalDark }) => {
      const root = document.documentElement;
      if (style === "6") {
        root.setAttribute("data-ui-style", "2");
        root.setAttribute("data-ui-palette", "midnight");
      } else if (style === "5") {
        root.setAttribute("data-ui-style", "2");
        root.setAttribute("data-ui-palette", "clinicsoft");
      } else if (style === "4") {
        root.setAttribute("data-ui-style", "2");
        root.setAttribute("data-ui-palette", "cobalt");
      } else if (style === "3") {
        root.setAttribute("data-ui-style", "2");
        root.setAttribute("data-ui-palette", "azure");
      } else {
        root.removeAttribute("data-ui-palette");
        root.setAttribute("data-ui-style", "2");
      }
      root.setAttribute("data-clinical-dark", clinicalDark ? "1" : "0");
      try {
        localStorage.setItem("drflow-ui-style", style);
        localStorage.setItem("drflow-clinical-dark", clinicalDark ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    { style: theme.style, clinicalDark: theme.clinicalDark }
  );
}
