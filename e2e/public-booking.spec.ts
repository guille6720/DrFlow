import { expect, test } from "@playwright/test";

import { hasE2EBookingSlug, readE2EBookingSlug } from "./helpers/e2e-env";

test.describe("Public booking E2E", () => {
  test.skip(
    !hasE2EBookingSlug(),
    "Set E2E_BOOKING_SLUG to run public booking page tests."
  );

  test("booking page loads and professional slots section appears", async ({ page }) => {
    const slug = readE2EBookingSlug();

    await page.goto(`/solicitar-turno/${slug}`);

    await expect(page.getByText("Reserva de turnos online")).toBeVisible({ timeout: 30_000 });

    const noProfessionals = page.getByText(
      "No hay profesionales disponibles para reserva online en este momento."
    );
    if (await noProfessionals.isVisible().catch(() => false)) {
      return;
    }

    await expect(page.getByRole("heading", { name: "Reservá tu turno" })).toBeVisible();

    const professionalSelect = page.getByLabel("Profesional");
    await professionalSelect.selectOption({ index: 1 });

    await expect(
      page.getByText(/Horario disponible|Cargando horarios|No hay turnos libres/i).first()
    ).toBeVisible({ timeout: 45_000 });
  });
});
