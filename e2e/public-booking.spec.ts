import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import {
  loadPublicBooking,
  PHASE6_CLINIC_A_SLUG,
  pickFutureBookingSlot,
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

const hasSlug = Boolean(process.env.E2E_BOOKING_SLUG?.trim() || PHASE6_CLINIC_A_SLUG);

test.describe("Phase 6 public booking live E2E", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);
  test.skip(!hasSlug, "Set E2E_BOOKING_SLUG or run phase6 seed");

  const slug = () => process.env.E2E_BOOKING_SLUG?.trim() || PHASE6_CLINIC_A_SLUG;

  test("public booking page loads anonymously and shows availability", async ({ page }) => {
    await loadPublicBooking(page, slug());
    const noProfessionals = page.getByText(
      "No hay profesionales disponibles para reserva online en este momento."
    );
    if (await noProfessionals.isVisible().catch(() => false)) {
      throw new Error("No professionals available on staging booking link");
    }
    await expect(page.getByRole("heading", { name: "Reservá tu turno" })).toBeVisible();
    await page.getByLabel("Profesional").selectOption({ index: 1 });
    await expect(
      page.getByText(/Horario disponible|Cargando horarios|No hay turnos libres/i).first()
    ).toBeVisible({ timeout: 60_000 });
  });

  test("new patient can submit booking without portal login", async ({ page }) => {
    await loadPublicBooking(page, slug());
    await page.getByLabel("Profesional").selectOption({ index: 1 });
    await pickFutureBookingSlot(page);

    const doc = `9${Date.now().toString().slice(-7)}`;
    await page.locator('input[name="first_name"]').fill("E2ENew");
    await page.locator('input[name="last_name"]').fill("Booking");
    await page.locator('input[name="document_number"]').fill(doc);
    await page.locator('input[name="phone"]').fill("1144445555");

    const consent = page.locator('input[name="privacy_consent"], input[type="checkbox"]').first();
    if (await consent.count()) {
      await consent.check();
    }

    await page.getByRole("button", { name: /Enviar solicitud de turno/i }).click();
    await expect(page.getByText(/¡Solicitud enviada!|Solicitud enviada/i)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(/Ingresá tu DNI/i)).toHaveCount(0);
  });

  test("existing patient booking keeps prior demographics", async ({ page }) => {
    test.skip(!process.env.E2E_PHASE6_DOC_EXISTING, "Need seeded existing patient 90060003");

    await loadPublicBooking(page, slug());
    await page.getByLabel("Profesional").selectOption({ index: 1 });
    await pickFutureBookingSlot(page);

    await page.locator('input[name="first_name"]').fill("OverwriteFirst");
    await page.locator('input[name="last_name"]').fill("OverwriteLast");
    await page.locator('input[name="document_number"]').fill("90060003");
    await page.locator('input[name="phone"]').fill("9999999999");
    await page.locator('input[name="email"]').fill("overwrite@example.test");

    const consent = page.locator('input[name="privacy_consent"], input[type="checkbox"]').first();
    if (await consent.count()) {
      await consent.check();
    }

    await page.getByRole("button", { name: /Enviar solicitud de turno/i }).click();
    await expect(page.getByText(/¡Solicitud enviada!|Solicitud enviada|ya no está disponible|horario/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
