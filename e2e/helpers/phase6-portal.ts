/**
 * Phase 6 live E2E helpers — staging only.
 * Tokens must never be logged.
 */
import { expect, type Page } from "@playwright/test";
import { createHash, randomBytes } from "crypto";

import { hasE2EBookingSlug, readE2EBookingSlug } from "./e2e-env";

export const PHASE6_CLINIC_A_ID = "a0000000-0000-4000-8000-000000000001";
export const PHASE6_CLINIC_A_SLUG = "centro-medico-norte-turnos";
export const PHASE6_CLINIC_B_SLUG = "mi-clinica-abuelitos";
export const PHASE6_PROFESSIONAL_ID = "b0000000-0000-4000-8000-000000000001";

export const PHASE6_DOC_A = "90060001";
export const PHASE6_DOC_B = "90060002";
export const PHASE6_DOC_EXISTING = "90060003";

export function hasPhase6E2EEnv(): boolean {
  return hasE2EBookingSlug();
}

export function readPhase6Slug(): string {
  return process.env.E2E_BOOKING_SLUG?.trim() || PHASE6_CLINIC_A_SLUG;
}

export function newPortalToken(): string {
  return randomBytes(32).toString("hex");
}

export function tokenSha256(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

export function hexTokenHashLiteral(token: string): string {
  return `\\x${tokenSha256(token).toString("hex")}`;
}

/** Assert cookie HttpOnly via Playwright cookie jar (document.cookie must not see it). */
export async function assertPortalCookieHttpOnly(page: Page) {
  const cookies = await page.context().cookies();
  const portal = cookies.find((c) => c.name === "drflow_patient_portal");
  expect(portal, "portal cookie missing").toBeTruthy();
  expect(portal!.httpOnly).toBe(true);
  expect(portal!.path).toBe("/portal");
  expect(portal!.sameSite.toLowerCase()).toBe("lax");

  const visible = await page.evaluate(() => document.cookie);
  expect(visible).not.toContain("drflow_patient_portal");
}

export async function assertNoTokenInWebStorage(page: Page, token: string) {
  const found = await page.evaluate((t) => {
    const keys = [...Object.keys(localStorage), ...Object.keys(sessionStorage)];
    const values = [
      ...keys.map((k) => localStorage.getItem(k) ?? ""),
      ...keys.map((k) => sessionStorage.getItem(k) ?? ""),
    ];
    return values.some((v) => v.includes(t));
  }, token);
  expect(found).toBe(false);
}

export async function openSecurePortalAccess(page: Page, slug: string, token: string) {
  await page.goto(`/portal/${slug}/access?token=${token}`);
  await expect(page).toHaveURL(new RegExp(`/portal/${slug}(\\?|$)`), { timeout: 45_000 });
  expect(page.url()).not.toContain("token=");
}

export async function goToMisTurnos(page: Page) {
  await page.getByRole("button", { name: "Mis turnos" }).click();
  await expect(page.getByText(/Acceso protegido al Portal del Paciente|Mis turnos/i).first()).toBeVisible({
    timeout: 30_000,
  });
}

/** Public booking anonymous smoke via page. */
export async function loadPublicBooking(page: Page, slug: string) {
  await page.goto(`/solicitar-turno/${slug}`);
  await expect(page.getByText(/Reserva de turnos online|Reservá tu turno/i).first()).toBeVisible({
    timeout: 45_000,
  });
}

export function assertPublicBookingJsonSafe(payload: unknown) {
  const text = JSON.stringify(payload ?? {});
  expect(text).not.toMatch(/"patient_id"/i);
  expect(text).not.toMatch(/"clinic_id"/i);
}

export { hasE2EBookingSlug, readE2EBookingSlug };
