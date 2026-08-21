import { expect, test } from "@playwright/test";

import { loginViaUi } from "./helpers/auth";
import { hasE2EAuthCredentials } from "./helpers/e2e-env";
import { ALL_APP_THEMES, applyAppTheme } from "./helpers/theme";

/**
 * Section 13 helper: capture screenshots of representative surfaces per theme
 * for human review under test-results/a11y-visual/.
 *
 * Run: npx playwright test e2e/a11y-visual-verify.spec.ts --project=a11y-desktop
 */
const VISUAL_PAGES = [
  { id: "login", path: "/login", auth: false },
  { id: "dashboard", path: "/dashboard", auth: true },
  { id: "configuracion", path: "/configuracion", auth: true },
  { id: "pacientes", path: "/pacientes", auth: true },
  { id: "historias", path: "/historias", auth: true },
  { id: "agenda", path: "/agenda", auth: true },
] as const;

test.describe("A11y visual capture for manual review", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "a11y-desktop",
      "Screenshot pack is desktop-only; tablet/mobile covered by a11y-theme-audit."
    );
  });

  for (const theme of ALL_APP_THEMES) {
    test(`login screenshot @ ${theme.id}`, async ({ page }, testInfo) => {
      await applyAppTheme(page, theme);
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await applyAppTheme(page, theme);
      await expect(page.locator("body")).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("a11y-visual", `login-${theme.id}.png`),
        fullPage: true,
      });
    });
  }

  test.describe("authenticated surfaces", () => {
    test.skip(!hasE2EAuthCredentials(), "Needs E2E_EMAIL / E2E_PASSWORD for app screenshots.");

    test.beforeEach(async ({ page }) => {
      await loginViaUi(page);
    });

    for (const theme of ALL_APP_THEMES.filter((t) =>
      ["style-6-dark", "style-6-light", "style-5-dark", "style-4-light", "style-2-dark"].includes(
        t.id
      )
    )) {
      for (const pageDef of VISUAL_PAGES.filter((p) => p.auth)) {
        test(`${pageDef.id} @ ${theme.id}`, async ({ page }, testInfo) => {
          await applyAppTheme(page, theme);
          await page.goto(pageDef.path, { waitUntil: "domcontentloaded" });
          await applyAppTheme(page, theme);
          await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
          await page.screenshot({
            path: testInfo.outputPath("a11y-visual", `${pageDef.id}-${theme.id}.png`),
            fullPage: true,
          });
        });
      }
    }
  });
});
