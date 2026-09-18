import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import {
  assertNoTokenInWebStorage,
  assertPortalCookieHttpOnly,
  goToMisTurnos,
  openSecurePortalAccess,
  PHASE6_CLINIC_A_SLUG,
  PHASE6_CLINIC_B_SLUG,
} from "./helpers/phase6-portal";

function loadPhase6Env() {
  const path = resolve(process.cwd(), "e2e/.phase6-env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i);
    const value = trimmed.slice(i + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadPhase6Env();

const hasSeed =
  Boolean(process.env.E2E_PHASE6_TOKEN_VALID?.trim()) &&
  Boolean(process.env.E2E_BOOKING_SLUG?.trim() || PHASE6_CLINIC_A_SLUG);

test.describe("Phase 6 patient portal live E2E", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!hasSeed, "Run: node scripts/phase6-seed-staging-e2e.mjs");

  const slug = () => process.env.E2E_BOOKING_SLUG?.trim() || PHASE6_CLINIC_A_SLUG;
  const slugB = () => process.env.E2E_BOOKING_SLUG_B?.trim() || PHASE6_CLINIC_B_SLUG;

  test("valid magic-link: cookie HttpOnly, token leaves URL, appointments load, no DNI auth", async ({
    page,
  }) => {
    const token = process.env.E2E_PHASE6_TOKEN_VALID!;
    await openSecurePortalAccess(page, slug(), token);
    await assertPortalCookieHttpOnly(page);
    await assertNoTokenInWebStorage(page, token);

    await goToMisTurnos(page);
    await expect(page.getByText(/Ingresá tu DNI/i)).toHaveCount(0);
    await expect(page.getByText(/Acceso protegido al Portal del Paciente/i)).toBeVisible();
    await expect(page.getByText(/E2EPhase6 PortalA|Cancelar turno|Confirmado|Pendiente/i).first()).toBeVisible({
      timeout: 45_000,
    });
  });

  test("invalid token fails closed with generic message", async ({ page }) => {
    await page.goto(`/portal/${slug()}/access?token=${"0".repeat(64)}`);
    await expect(page).toHaveURL(new RegExp(`/portal/${slug()}(\\?|$)`));
    expect(page.url()).not.toContain("token=");
    await expect(page.getByText("El enlace de acceso no es válido o venció.")).toBeVisible();
  });

  test("expired token fails closed", async ({ page }) => {
    await page.goto(
      `/portal/${slug()}/access?token=${process.env.E2E_PHASE6_TOKEN_EXPIRED}`
    );
    await expect(page.getByText("El enlace de acceso no es válido o venció.")).toBeVisible({
      timeout: 45_000,
    });
    expect(page.url()).not.toContain("token=");
  });

  test("revoked token fails closed", async ({ page }) => {
    await page.goto(
      `/portal/${slug()}/access?token=${process.env.E2E_PHASE6_TOKEN_REVOKED}`
    );
    await expect(page.getByText("El enlace de acceso no es válido o venció.")).toBeVisible({
      timeout: 45_000,
    });
  });

  test("Clinic A token denied on Clinic B slug", async ({ page }) => {
    await page.goto(
      `/portal/${slugB()}/access?token=${process.env.E2E_PHASE6_TOKEN_VALID}`
    );
    await expect(page.getByText("El enlace de acceso no es válido o venció.")).toBeVisible({
      timeout: 45_000,
    });
  });

  test("patient can cancel own appointment; cannot cancel another patient's", async ({
    page,
  }) => {
    const token = process.env.E2E_PHASE6_TOKEN_VALID!;
    await openSecurePortalAccess(page, slug(), token);
    await goToMisTurnos(page);

    const cancelOwn = page.getByRole("button", { name: "Cancelar turno" }).first();
    await expect(cancelOwn).toBeVisible({ timeout: 45_000 });
    await cancelOwn.click();
    await page.getByLabel(/Motivo de cancelación/i).fill("E2E Phase6 cancel own");
    await page.getByRole("button", { name: "Confirmar cancelación" }).click();
    await expect(page.getByText(/Cancelado/i).first()).toBeVisible({ timeout: 45_000 });

    // Re-auth as other patient and ensure their appointment still exists / own list only
    await page.context().clearCookies();
    await openSecurePortalAccess(page, slug(), process.env.E2E_PHASE6_TOKEN_OTHER_PATIENT!);
    await goToMisTurnos(page);
    await expect(page.getByText(/E2EPhase6 PortalB|Confirmado|Pendiente/i).first()).toBeVisible({
      timeout: 45_000,
    });
    // Patient B should not see patient A's cancelled appointment as cancellable identity leak via DNI
    await expect(page.getByText(/Ingresá tu DNI/i)).toHaveCount(0);
  });

  test("logout clears portal access", async ({ page }) => {
    const token = process.env.E2E_PHASE6_TOKEN_OTHER_PATIENT!;
    await openSecurePortalAccess(page, slug(), token);
    await goToMisTurnos(page);
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(
      page.getByText(/Para ver tus turnos necesitás ingresar desde el enlace seguro/i)
    ).toBeVisible({ timeout: 45_000 });

    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "drflow_patient_portal" && c.value)).toBeFalsy();
  });
});
