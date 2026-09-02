import { expect, test } from "@playwright/test";

import { loginViaUi } from "./helpers/auth";
import { hasE2EAuthCredentials } from "./helpers/e2e-env";
import { ALL_APP_THEMES, applyAppTheme } from "./helpers/theme";

/**
 * Visual capture pack for manual theme QA.
 * Surfaces: Dashboard / Turnos / Pacientes / HC / Consultas / Sala de espera
 * × Clinical Blue + Medical Slate × light/dark.
 *
 * Run against staging:
 *   $env:PLAYWRIGHT_BASE_URL="https://drflow-app-git-release-0219-staging-promotion-guillermo-c-bmw.vercel.app"
 *   $env:PLAYWRIGHT_SKIP_WEBSERVER="1"
 *   npx playwright test e2e/a11y-visual-verify.spec.ts --project=a11y-desktop
 *
 * Screenshots: test-results/.../a11y-visual/
 */
const VISUAL_PAGES = [
  { id: "dashboard", path: "/dashboard" },
  { id: "turnos", path: "/turnos" },
  { id: "pacientes", path: "/pacientes" },
  { id: "historias", path: "/historias" },
  { id: "consultas", path: "/consultas" },
  { id: "sala-espera", path: "/sala-espera" },
] as const;

test.describe("Theme visual QA — dashboard clinical pack", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "a11y-desktop",
      "Screenshot pack is desktop-only."
    );
  });

  test.skip(!hasE2EAuthCredentials(), "Needs E2E_EMAIL / E2E_PASSWORD.");

  test.beforeEach(async ({ page }) => {
    await loginViaUi(page);
  });

  for (const theme of ALL_APP_THEMES) {
    for (const pageDef of VISUAL_PAGES) {
      test(`${pageDef.id} @ ${theme.id}`, async ({ page }, testInfo) => {
        await applyAppTheme(page, theme);
        await page.goto(pageDef.path, { waitUntil: "domcontentloaded" });
        await applyAppTheme(page, theme);
        await page.waitForTimeout(400);
        await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
        await expect(page.locator("body")).toBeVisible();

        const attrs = await page.evaluate(() => ({
          style: document.documentElement.getAttribute("data-ui-style"),
          palette: document.documentElement.getAttribute("data-ui-palette"),
          dark: document.documentElement.getAttribute("data-clinical-dark"),
          primary: getComputedStyle(document.documentElement)
            .getPropertyValue("--primary")
            .trim(),
        }));
        expect(attrs.style).toBe("2");
        expect(attrs.palette).toBe(theme.style);
        expect(attrs.dark).toBe(theme.clinicalDark ? "1" : "0");
        expect(attrs.primary.length).toBeGreaterThan(0);

        await page.screenshot({
          path: testInfo.outputPath("a11y-visual", `${pageDef.id}__${theme.id}.png`),
          fullPage: true,
        });
      });
    }
  }
});
