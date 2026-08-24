import { expect, test } from "@playwright/test";

import { expectNoSeriousAxeViolations, expectReadableSampledContrast } from "./helpers/a11y";
import { loginViaUi } from "./helpers/auth";
import { hasE2EAuthCredentials } from "./helpers/e2e-env";
import { ALL_APP_THEMES, applyAppTheme, type ThemeFixture } from "./helpers/theme";

/** Representative page per major clinical module. */
const MODULE_PAGES: Array<{ module: string; path: string }> = [
  { module: "dashboard", path: "/dashboard" },
  { module: "agenda", path: "/agenda" },
  { module: "turnos", path: "/turnos" },
  { module: "pacientes", path: "/pacientes" },
  { module: "historias", path: "/historias" },
  { module: "consultas", path: "/consultas" },
  { module: "recetas", path: "/recetas" },
  { module: "guia-pami", path: "/guia-pami" },
  { module: "farmacologia", path: "/herramientas/farmacologia" },
  { module: "configuracion", path: "/configuracion" },
  { module: "ayuda", path: "/ayuda" },
];

const PUBLIC_PAGES: Array<{ module: string; path: string }> = [
  { module: "marketing-home", path: "/" },
  { module: "planes", path: "/planes" },
  { module: "privacidad", path: "/privacidad" },
  { module: "login", path: "/login" },
];

async function settle(page: import("@playwright/test").Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(250);
}

async function auditPage(
  page: import("@playwright/test").Page,
  label: string,
  path: string,
  theme?: ThemeFixture
) {
  if (theme) {
    await applyAppTheme(page, theme);
  }
  await page.goto(path, { waitUntil: "domcontentloaded" });
  if (theme) {
    await applyAppTheme(page, theme);
    await page.waitForTimeout(100);
  }
  await settle(page);
  await expect(page.locator("body")).toBeVisible();
  await expectNoSeriousAxeViolations(page, label);
  await expectReadableSampledContrast(page, label);
}

test.describe("A11y automated audit — public pages × themes", () => {
  for (const theme of ALL_APP_THEMES) {
    test(`login @ ${theme.id}`, async ({ page }) => {
      // Login is the app chrome surface that still honors clinical themes
      await auditPage(page, `login/${theme.id}`, "/login", theme);
      await expect(page.getByRole("button", { name: /ingresar|iniciar/i })).toBeVisible();
    });
  }

  for (const pub of PUBLIC_PAGES.filter((p) => p.path !== "/login")) {
    test(`${pub.module} (marketing light)`, async ({ page }) => {
      await auditPage(page, pub.module, pub.path);
    });
  }
});

test.describe("A11y automated audit — modules (default theme)", () => {
  test.skip(
    !hasE2EAuthCredentials(),
    "Set E2E_EMAIL and E2E_PASSWORD to audit authenticated modules."
  );

  test.beforeEach(async ({ page }) => {
    await loginViaUi(page);
  });

  for (const mod of MODULE_PAGES) {
    test(`${mod.module} ${mod.path}`, async ({ page }) => {
      await auditPage(page, mod.module, mod.path);
      // Still on app (or allowed redirect within dashboard shell)
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    });
  }
});

test.describe("A11y automated audit — modules × every theme (desktop sample)", () => {
  test.skip(
    !hasE2EAuthCredentials(),
    "Set E2E_EMAIL and E2E_PASSWORD to audit authenticated themes."
  );

  // Full theme matrix on a small representative set to keep runtime practical
  const THEME_SAMPLE_PAGES = MODULE_PAGES.filter((m) =>
    ["dashboard", "pacientes", "configuracion"].includes(m.module)
  );

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "a11y-desktop",
      "Theme × module matrix runs on a11y-desktop only; tablet/mobile cover default-theme modules."
    );
    await loginViaUi(page);
  });

  for (const theme of ALL_APP_THEMES) {
    for (const mod of THEME_SAMPLE_PAGES) {
      test(`${mod.module} @ ${theme.id}`, async ({ page }) => {
        await auditPage(page, `${mod.module}/${theme.id}`, mod.path, theme);
        await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      });
    }
  }
});
